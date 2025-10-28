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

const PORT = 8080;
const app = express();
const saltRounds = 10;

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

export const server = createServer(app).listen(PORT, function (err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});