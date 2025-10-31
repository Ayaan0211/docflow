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

// tables
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

function createDocumentsTable() {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
    document_id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `)
    .then(() => console.log("✅ Documents table ready"))
    .catch(err => console.error("❌ Error creating documents table:", err.message));
}

function createSharedDocumentsTable() {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS shared_documents (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) CHECK (permission IN ('view', 'edit')),
    UNIQUE (document_id, user_id)
    );
    `)
    .then(() => console.log("✅ Shared Documents table ready"))
    .catch(err => console.error("❌ Error creating shared documents table:", err.message));
}

// indexes for faster queries
function createIndexes() {
  return pool.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shared_documents_user_id ON shared_documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_shared_documents_document_id ON shared_documents(document_id);
  `)
  .then(() => console.log("✅ Indexes ready"))
  .catch(err => console.error("❌ Error creating indexes:", err.message));
}

// initialize tables
createUsersTable()
  .then(createDocumentsTable)
  .then(createSharedDocumentsTable)
  .then(createIndexes)
  .then(() => console.log("✅ Database initialization complete"))
  .catch(err => console.error("❌ Database initialization failed:", err.message));
// Chain more tables above as needed

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
  req.email = req.session.email ? req.session.email : null;
  console.log("HTTP request", req.email, req.method, req.url, req.body);
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
    pool.query("SELECT * FROM users WHERE google_id = $1", [googleId], (err, result) => {
      if (err) return cb(err);
      // existing user
      if (result.rows.length > 0) return cb(null, result.rows[0]);
      // new user
      pool.query("INSERT INTO users(name, email, google_id) VALUES ($1, $2, $3) RETURNING *", [name, email, googleId], (err, dbResult) => {
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
  if (!req.session.email) return res.status(401).end("access denied");
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

const sanitizeDocument = function(req, res, next) {
  req.body.title = validator.escape(req.body.title);
  req.body.content = validator.escape(req.body.content);
  next();
}

const sanitizeSharingCredentials = function(req, res, next) {
  if (!validator.isEmail(req.body.email)) return res.status(400).end("Invalid email format");
  req.body.permission = validator.escape(req.body.permission);
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
        pool.query("INSERT INTO users(name, password, email) VALUES ($1, $2, $3)", [username, hash, email], function(err) {
          if (err) return res.status(500).end(err);
          // start session
          req.session.email = email;
          return res.json({
            username, 
            email
          });
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
  pool.query("SELECT * FROM users WHERE email = $1", [email], (err, result) => {
    if (err) return res.status(500).end(err);
    if (result.rows.length === 0) return res.status(401).end("User does not exist!");
    const user = result.rows[0];
    compare(password, user.password, (err, valid) => {
      if (err) return res.status(500).end(err);
      if (!valid) return res.status(401).end("Password is incorrect!");
      req.session.email = user.email;
      return res.json({
            username: user.name, 
            email: user.email
          });
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
    req.session.email = req.user.email
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
// make a document
app.post("/api/user/documents/", isAuthenticated, sanitizeDocument, function(req, res, next) {
  if (!req.body.title || !req.body.content) return res.status(400).end("Missing title or content");
  const title = req.body.title;
  const content = req.body.content;
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
      INSERT INTO documents(owner_id, title, content) 
      VALUES ($1, $2, $3) 
      RETURNING document_id, title, content
      `, [userId, title, content], (err, result) => {
        if (err) return res.status(500).end(err);
        res.json({
          document: result.rows[0]
        })
      });
    });
});

// share a document
app.post("/api/user/documents/:documentId/", isAuthenticated, sanitizeSharingCredentials, function(req, res, next) {
  const otherEmail = req.body.email;
  const permission = req.body.permission;
  const docId = req.params.documentId;
  if (!["view", "edit"].includes(permission)) return res.status(400).end("Invalid type of permission");
  pool.query(`
    SELECT DISTINCT id
    FROM documents
    NATURAL JOIN shared_documents
    WHERE document_id = $1 AND permission = 'edit'
    `, [docId], (err, sharePermsIdRows) => {
      if (err) return res.status(500).end(err);
      // grab all ids of people currently shared to the doc that can edit and check user that's trying to grant other user is one of them
      const sharePermsIds = sharePermsIdRows.rows.map(row => row.id);
      pool.query(`
        SELECT owner_id
        FROM documents
        WHERE document_id = $1
        `, [docId], (err, ownerIdRow) => {
          if (err) return res.status(500).end(err);
          sharePermsIds.push(ownerIdRow.rows[0].owner_id);
          pool.query(`
            SELECT id
            FROM users
            WHERE email = $1
            `, [req.email], (err, currIdRow) => {
              if (err) return res.status(500).end(err);
              if (currIdRow.rows.length === 0) return res.status(401).end("Invalid session");
              const currId = currIdRow.rows[0].id;
              if (!sharePermsIds.includes(currId)) return res.status(403).end("You don't have permission to share this document");
              pool.query(`
              SELECT id
              FROM users
              WHERE email = $1
              `, [otherEmail], (err, otherUserIdRow) => {
                if (err) return res.status(500).end(err);
                if (otherUserIdRow.rows.length === 0) return res.status(400).end(`Invalid, email, ${otherEmail}, is not a valid user`);
                const otherUserId = otherUserIdRow.rows[0].id;
                pool.query(`
                  INSERT INTO shared_documents(document_id, user_id, permission)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (document_id, user_id)
                  DO UPDATE SET permission = EXCLUDED.permission
                  RETURNING *
                  `, [docId, otherUserId, permission], (err, result) => {
                    if (err) return res.status(500).end(err);
                    res.json({
                      result: result.rows[0]
                    })
                  });
              });
            });
        });
    });
});

// READ
app.get("/api/session/", function(req, res, next) {
  res.json({
    isLoggedIn: req.email ? true : false,
    username: req.email
  })
});

// get documents paginated
app.get("/api/user/documents/", isAuthenticated, function(req, res, next) {
  const page = parseInt(req.query.page);
  const maxDocuments = parseInt(req.query.maxDocuments);
  const offset = (page - 1) * maxDocuments;
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
        SELECT COUNT(DISTINCT d.document_id)
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id
        WHERE d.owner_id = $1 OR s.user_id = $1 
        `, [userId], (err, totalDocumentsRow) => {
          if (err) return res.status(500).end(err);
          const totalDocuments = parseInt(totalDocumentsRow.rows[0].count);
          pool.query(`
            SELECT DISTINCT d.document_id, d.owner_id, d.title, d.last_modified
            FROM documents d
            LEFT JOIN shared_documents s ON d.document_id = s.document_id
            WHERE d.owner_id = $1 OR s.user_id = $1
            ORDER BY last_modified DESC
            LIMIT $2 OFFSET $3
            `, [userId, maxDocuments, offset], (err, result) => {
              if (err) return res.status(500).end(err);
              res.json({
                hasPrev: page > 1,
                hasNext: (page * maxDocuments) < totalDocuments,
                documents: result.rows
              });
          });
        });
    });
});

// get single document
app.get("/api/documents/:documentId/", isAuthenticated, function(req, res, next) {
  const docId = req.params.documentId;
  pool.query(`
    SELECT *
    FROM DOCUMENTS
    WHERE document_id = $1
    `, [docId], (err, document) => {
      if (err) return res.status(500).end(err);
      if (document.rows.length === 0) {
        return res
        .status(404)
        .end("Document " + docId + " does not exist.");
      }
      res.json({
        document: document.rows[0]
      });
    });
});

// UPDATE
// update document (if person has edit access)
app.patch("/api/documents/:documentId/", isAuthenticated, sanitizeDocument, function(req, res, next) {
  if (!req.body.title || !req.body.content) return res.status(400).end("Missing title or content");
  const title = req.body.title;
  const content = req.body.content;
  const docId = req.params.documentId;
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR (s.user_id = $2 AND s.permission = 'edit'))
        `, [docId, userId], (err, permissionResultRow) => {
          if (err) return res.status(500).end(err);
          if (permissionResultRow.rows.length === 0) return res.status(403).end("You don't have permission to edit this document");
          pool.query(`
            UPDATE documents
            SET content = $1, title = $2, last_modified = CURRENT_TIMESTAMP
            WHERE document_id = $3
            RETURNING document_id, title, content, last_modified
            `, [content, title, docId], (err, document) => {
              if (err) return res.status(500).end(err);
              res.json({
                document: document.rows[0]
              });
            })
        });
    });
});

// DELETE
// delete document (only owners can delete)
app.delete("/api/documents/:documentId/", isAuthenticated, function(req, res, next) {
  const docId = req.params.documentId;
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
        SELECT owner_id
        FROM documents
        WHERE document_id = $1
        `, [docId], (err, ownerIdRow) => {
          if (err) return res.status(500).end(err);
          if (ownerIdRow.rows.length === 0) return res.status(404).end("Document not found");
          const ownerId = ownerIdRow.rows[0].owner_id;
          if (userId !== ownerId) return res.status(403).end("You don't have permission to delete this document");
          pool.query(`
            DELETE FROM documents
            WHERE document_id = $1
            RETURNING title
            `, [docId], (err, result) => {
              if (err) return res.status(500).end(err);
              res.json({
                document: result.rows[0]
              });
            });
        });
    });
});

// delete other user from document (sharing)
app.delete("/api/documents/:documentId/users/", isAuthenticated, checkEmail, function(req, res, next) {
  if (!('email' in req.body)) return res.status(400).end('email is missing');
  const docId = req.params.documentId;
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
        SELECT owner_id
        FROM documents
        WHERE document_id = $1
        `, [docId], (err, ownerIdRow) => {
          if (err) return res.status(500).end(err);
          if (ownerIdRow.rows.length === 0) return res.status(404).end("Document not found");
          const ownerId = ownerIdRow.rows[0].owner_id;
          if (userId !== ownerId) return res.status(403).end("You don't have permission to delete this document");
          pool.query(`
            SELECT id
            FROM users
            WHERE email = $1
            `, [req.body.email], (err, shareUserIdRow) => {
              if (err) return res.status(500).end(err);
              if (shareUserIdRow.rows.length === 0) return res.status(404).end("User not found");
              const shareUserId = shareUserIdRow.rows[0].id;
              pool.query(`
                DELETE FROM shared_documents
                WHERE document_id = $1 AND user_id = $2
                `, [docId, shareUserId], (err) => {
                  if (err) return res.status(500).end(err);
                  res.json({
                    removedEmail: req.body.email
                  })
                });
            });
        });
    });
});

// RTC

export const server = createServer(app).listen(PORT, function (err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});