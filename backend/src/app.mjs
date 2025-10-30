import 'dotenv/config';
import { createServer } from "http";
import express from "express";
import session from "express-session";
import { resolve } from "path";
import fs from "fs";
import path from "path";
import { rmSync } from "fs";
import { compare, genSalt, hash } from "bcrypt";
import cors from "cors";
import pkg from "pg";
import validator from "validator";
import passport from "passport";
import { Strategy as GoogleStrategy, Strategy } from "passport-google-oauth20";

const PORT = 8080;
const app = express();
const saltRounds = 10;
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// initalize tabels
function createUsersTable() {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    password TEXT,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL
    );
    `)
    .then(() => console.log("✅ Users table ready"))
    .catch(err => console.error("❌ Error creating users table:", err.message));
}

createUsersTable()
  .then(() => console.log("✅ Database initialization complete"))
  .catch(err => console.error("❌ Database initialization failed:", err.message));
// CHain more tables above as needed

app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { 
	  sameSite: true,
	  secure: process.env.NODE_ENV == "prod", // sets the secure flag only with HTTPS in production 
  }
}));

app.use(function (req, res, next) {
  req.username = req.session.username ? req.session.username : null;
  console.log("HTTP request", req.username, req.method, req.url, req.body);
  next();
});

app.use(express.urlencoded({ extended: false }));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/oauth2/redirect/google/"}, function verify(accessToken, refreshToken, profile, cb) {
    const googleId = profile.id;
    const name = profile.displayName;
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    // check if user is in db
    pool.query("SELECT * from users WHERE google_id = $1", [googleId], (err, result) => {
      if (err) return cb(err);
      // existing user
      if (result.rows.length > 0) return cb(null, result.rows[0]);
      // new user
      pool.query("INSERT into users(name, email, google_id) VALUES ($1, $2, $3) RETURNING *", [name, email, googleId], (err, dbResult) => {
        if (err) return cb(err);
        return cb(null, dbResult.rows[0]);
      });
    });
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(passport.authenticate('session'));

passport.serializeUser(function (user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function (id, cb) {
  pool.query("SELECT * FROM users WHERE id = $1", [id], function (err, result) {
    if (err) return cb(err);
    cb(null, result.rows[0]);
  });
});

if (process.env.NODE_ENV=="dev") app.use(cors({ origin: "http://localhost:3000", credentials: true }));

function isAuthenticated(req, res, next) {
  if (!req.session.username) return res.status(401).end("access denied");
  next();
}

const checkCredentials = function(req, res, next) {
  if (!validator.isAlphanumeric(req.body.username)) return res.status(400).end("bad username input");
  if (!validator.isEmail(req.body.email)) return res.status(400).end("bad email input");
  next();
};

const checkEmail = function(req, res, next) {
  if (!validator.isEmail(req.body.email)) return res.status(400).end("bad email input");
  next();
}

const sanitizeContent = function(req, res, next) {
  req.body.content = validator.escape(req.body.content);
  next();
}

// sign up local auth
app.post("/api/signup/", checkCredentials, function(req, res, next) {
  // extract data from HTTP request
  if (!('username' in req.body)) return res.status(400).end('username is missing');
  if (!('email' in req.body)) return res.status(400).end('email is missing');
  if (!('password' in req.body)) return res.status(400).end('password is missing');
  const username = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
  // check if user already exists in the database
  pool.query("SELECT * FROM users WHERE email = $1", [email], function(err, result) {
    if (err) return res.status(500).end(err);
    if (result.rows.length > 0) return res.status(409).end("Email already exists, please sign in");
    genSalt(saltRounds, function(err, salt) {
      if (err) return res.status(500).end(err);
      hash(password, salt, function(err, hash) {
        if (err) return res.status(500).end(err);
        pool.query("INSERT into users(name, password, email) VALUES ($1, $2, $3)", [username, hash, email], function(err) {
          if (err) return res.status(500).end(err);
          // start session
          req.session.username = username;
          return res.json(username);
        });
      });
    });
  });
});

// sign in local auth
app.post("/api/signin/", checkEmail, function (req, res, next){
  // extract data from HTTP request
  if (!('email' in req.body)) return res.status(400).end('email is missing');
  if (!('password' in req.body)) return res.status(400).end('password is missing');
  const email = req.body.email;
  const password = req.body.password;
  pool.query("SELECT * from users where email = $1", [email], (err, result) => {
    if (err) return res.status(500).end(err);
    if (result.rows.length === 0) return res.status(401).end("User does not exist!");
    const user = result.rows[0];
    compare(password, user.password, (err, valid) => {
      if (err) return res.status(500).end(err);
      if (!valid) return res.status(401).end("Password is incorrect!");
      req.session.username = user.name;
      return res.json(user.name);
    });
  });
});

// sign in google auth
app.get("/api/oauth2/google/", (req, res, next) => {
  // temp set it to lax so we can get the cookies from oauth
  req.session.cookie.sameSite = "lax";
  req.session.save(() => next());
}, passport.authenticate("google", { scope: ["profile", "email"] }));

// sign in redirect
app.get("/api/oauth2/redirect/google/", 
  passport.authenticate("google", { failureRedirect: "/"}), (req, res) => {
    req.session.cookie.sameSite = "strict";
    req.session.username = req.user.name
    delete req.user;
    res.redirect("/");
  }
);

// sign out
app.get("/api/signout/", isAuthenticated, function (req, res, next) {
  req.session.destroy(function(err) {
    if (err) return res.status(500).end(err);
    res.redirect("/");
  });
});

// CREATE

// READ
app.get("/api/session/", function(req, res, next) {
  res.json({
    isLoggedIn: req.username ? true : false,
    username: req.username
  })
});

// UPDATE

// DELETE

// RTC



export const server = createServer(app).listen(PORT, function (err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});