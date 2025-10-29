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
import pkg from "pg"

const PORT = 8080;
const app = express();
const saltRounds = 10;
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.DB_HOST || "postgres",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || process.env.POSTGRES_USER,
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME || process.env.POSTGRES_DB
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

if (process.env.NODE_ENV=="dev") app.use(cors({ origin: "http://localhost:3000", credentials: true }));

function isAuthenticated(req, res, next) {
  if (!req.session.username) return res.status(401).end("access denied");
  next();
}

// sign up local auth

// sign in local auth

// sign in google auth

// sign out local auth

// get documents



export const server = createServer(app).listen(PORT, function (err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});