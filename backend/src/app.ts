import 'dotenv/config';
import { createServer } from "http";
import express from "express";
import session from "express-session";
import { compare, genSalt, hash } from "bcrypt";
import cors from "cors";
import { Pool } from "pg";
import validator from "validator";
import passport, { use } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Request, Response, NextFunction } from "express";
import { Profile } from "passport-google-oauth20";
import { VerifyCallback } from "passport-oauth2";
import * as WebRTCManager from './webRTCManager';
import { RTCSessionDescription } from "@koush/wrtc";

const PORT = 8080;
const app = express();
const saltRounds = 10;

export const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
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
    content JSONB NOT NULL,
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

function createDocumentVersionsTable() {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS document_versions (
    version_id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `)
    .then(() => console.log("✅ Documents Versions table ready"))
    .catch(err => console.error("❌ Error creating document versions table:", err.message));
}

// indexes for faster queries
function createIndexes() {
  return pool.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shared_documents_user_id ON shared_documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_shared_documents_document_id ON shared_documents(document_id);
    CREATE INDEX IF NOT EXISTS idx_versions_document_id ON document_versions(document_id);
  `)
  .then(() => console.log("✅ Indexes ready"))
  .catch(err => console.error("❌ Error creating indexes:", err.message));
}

// initialize tables
createUsersTable()
  .then(createDocumentsTable)
  .then(createSharedDocumentsTable)
  .then(createDocumentVersionsTable)
  .then(createIndexes)
  .then(() => console.log("✅ Database initialization complete"))
  .catch(err => console.error("❌ Database initialization failed:", err.message));
// Chain more tables above as needed

app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: true,
  cookie: { 
	  sameSite: true,
	  secure: process.env.NODE_ENV == "prod", // sets the secure flag only with HTTPS in production 
  }
}));

app.use(express.urlencoded({ extended: false }));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "/api/oauth2/redirect/google/"}, function verify(accessToken: string, refreshToken: string, profile: Profile, cb: VerifyCallback) {
    const googleId = profile.id;
    const name = profile.displayName;
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    // check if user is in db
    pool.query("SELECT * FROM users WHERE google_id = $1 OR email = $2", [googleId, email], (err, result) => {
      if (err) return cb(err);
      // existing user
      if (result.rows.length > 0) {
        const existingUser = result.rows[0];
        // existing local user with email but now is signing in with google first time (link account)
        if (!existingUser.google_id) {
          pool.query(`
            UPDATE users
            SET google_id = $1
            WHERE email = $2
            RETURNING *
            `, [googleId, email], (err, updated) => {
              if (err) return cb(err);
              return cb(null, updated.rows[0]);
            });
        } else {
          // exisitng google user
          return cb(null, existingUser);
        }
      }
      // new user completly (no local auth)
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

app.use(function (req: Request, res: Response, next: NextFunction) {
  req.email = req.session.email ? req.session.email : null;
  console.log("HTTP request", req.email, req.method, req.url, req.body);
  next();
});

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

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.email) return res.status(401).end("access denied");
  next();
}

const checkCredentials = function(req: Request, res: Response, next: NextFunction) {
  if (!validator.isAlphanumeric(req.body.username)) return res.status(400).end("bad username input");
  if (!validator.isEmail(req.body.email)) return res.status(400).end("bad email input");
  next();
};

const checkEmail = function(req: Request, res: Response, next: NextFunction) {
  if (!validator.isEmail(req.body.email)) return res.status(400).end("bad email input");
  next();
}

const sanitizeDocument = function(req: Request, res: Response, next: NextFunction) {
  req.body.title = validator.escape(req.body.title.trim());
  try {
    if (typeof req.body.content === "string") {
      req.body.content = JSON.parse(req.body.content);
    }
  } catch {
    return res.status(400).end("Invalid content format");
  }
  next();
}

const sanitizeContent = function(req: Request, res: Response, next: NextFunction) {
  try {
    if (typeof req.body.content === "string") {
      req.body.content = JSON.parse(req.body.content);
    }
  } catch {
    return res.status(400).end("Invalid content format");
  }
  next();
}

const sanitizeTitle = function(req: Request, res: Response, next: NextFunction) {
  req.body.title = validator.escape(req.body.title.trim());
  next();
}

const sanitizeSharingCredentials = function(req: Request, res: Response, next: NextFunction) {
  if (!validator.isEmail(req.body.email)) return res.status(400).end("Invalid email format");
  req.body.permission = validator.escape(req.body.permission);
  next();
}

// sign up local auth
app.post("/api/signup/", checkCredentials, function(req: Request, res: Response, next: NextFunction) {
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
app.post("/api/signin/", checkEmail, function (req: Request, res: Response, next: NextFunction){
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
app.get("/api/oauth2/google/", (req: Request, res: Response, next: NextFunction) => {
  // temp set it to lax so we can get the cookies from oauth
  req.session.cookie.sameSite = "lax";
  req.session.save(() => next());
}, passport.authenticate("google", { scope: ["profile", "email"] }));

// sign in redirect
app.get("/api/oauth2/redirect/google/", 
  passport.authenticate("google", { failureRedirect: "/"}), (req: Request, res) => {
    req.session.cookie.sameSite = "strict";
    req.session.email = req.user!.email;
    delete req.user;
    res.redirect("/");
  }
);

// sign out
app.get("/api/signout/", isAuthenticated, function (req: Request, res: Response, next: NextFunction) {
  req.session.destroy(function(err) {
    if (err) return res.status(500).end(err);
    res.redirect("/");
  });
});

// CREATE
// make a document
app.post("/api/user/documents/", isAuthenticated, sanitizeDocument, function(req: Request, res: Response, next: NextFunction) {
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
app.post("/api/user/documents/:documentId/", isAuthenticated, sanitizeSharingCredentials, function(req: Request, res: Response, next: NextFunction) {
  const otherEmail = req.body.email;
  const permission = req.body.permission;
  const docId = parseInt(req.params.documentId);
  if (!["view", "edit"].includes(permission)) return res.status(400).end("Invalid type of permission");

  pool.query(`
    SELECT owner_id
    FROM documents
    WHERE document_id = $1
    `, [docId], (err, ownerIdRow) => {
      if (err) return res.status(500).end(err);
      if (ownerIdRow.rows.length === 0) return res.status(404).end("Document not found");
      const owner_id = ownerIdRow.rows[0].owner_id;
      pool.query(`
        SELECT DISTINCT id
        FROM documents
        NATURAL JOIN shared_documents
        WHERE document_id = $1 AND permission = 'edit'
        `, [docId], (err, sharePermsIdRows) => {
          if (err) return res.status(500).end(err);
          // grab all ids of people currently shared to the doc that can edit and check user that's trying to grant other user is one of them
          const sharePermsIds = sharePermsIdRows.rows.map(row => row.id);
          sharePermsIds.push(owner_id);
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

// restore a specifc version (only owners can restore a version)
app.post("/api/documents/:documentId/versions/:versionId", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  const versionId = req.params.versionId;
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
          if (ownerIdRow.rows.length === 0) return res.status(401).end("Invalid session");
          const ownerId = ownerIdRow.rows[0].owner_id;
          if (userId !== ownerId) return res.status(403).end("You don't have permission to restore this version");
          // save current version of the document and then restore the specififed version
          pool.query(`
            SELECT content
            FROM document_versions
            WHERE version_id = $1
            `, [versionId], (err, versionRow) => {
              if (err) return res.status(500).end(err);
              if (versionRow.rows.length === 0) return res.status(400).end("Version not found");
              const version_content = versionRow.rows[0].content;
              pool.query(`
                SELECT content
                FROM documents
                WHERE document_id = $1
                `, [docId], (err, currentDocumentRow) => {
                  if (err) return res.status(500).end(err);
                  if (currentDocumentRow.rows.length === 0) return res.status(400).end("Document not found");
                  const curr_content = currentDocumentRow.rows[0].content;
                  pool.query(`
                    INSERT INTO document_versions(document_id, edited_by, content)
                    VALUES ($1, $2, $3)
                    `, [docId, userId, curr_content], (err) => {
                      if (err) return res.status(500).end(err);
                      pool.query(`
                        UPDATE documents
                        SET content = $1, last_modified = CURRENT_TIMESTAMP
                        WHERE document_id = $2
                        RETURNING *
                        `, [version_content, docId], (err, updatedDoc) => {
                          if (err) return res.status(500).end(err);
                          res.json({
                            document: updatedDoc.rows[0]
                          })
                        });
                    });
                });
            });
        });
    });
});

// READ
app.get("/api/session/", function (req: Request, res: Response, next: NextFunction) {
  if (req.email) {
    pool.query(
      "SELECT name FROM users WHERE email = $1",
      [req.email],
      (err, nameRow) => {
        if (err) return res.status(500).end(err);
        if (nameRow.rows.length === 0) return res.status(401).end("Invalid session");

        const username = nameRow.rows[0].name;
        res.json({
          isLoggedIn: true,
          email: req.email,
          username,
        });
      }
    );
  } else {
    res.json({
      isLoggedIn: false,
      email: null,
      username: null,
    });
  }
});


// get documents paginated
app.get("/api/user/documents/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string);
  const maxDocuments = parseInt(req.query.maxDocuments as string);
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
            SELECT DISTINCT d.document_id, d.owner_id, d.title, d.last_modified, u.name as owner_name, CASE WHEN d.owner_id = $1 THEN 'owner' else s.permission END as permission
            FROM documents d
            JOIN users u ON d.owner_id = u.id
            LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $1
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
app.get("/api/documents/:documentId/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
        SELECT d.*, s.permission
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `, [docId, userId], (err, result) => {
          if (err) return res.status(500).end(err);
          if (result.rows.length === 0) return res.status(403).end("You do not have access to this document");
          const doc = result.rows[0];
          const canEdit = doc.owner_id === userId || doc.permission === 'edit';
          res.json({
            document: doc,
            canEdit
          })
        });
    });
});

// get version history paginated, only owner should see document history
app.get("/api/documents/:documentId/versions/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  const page = parseInt(req.query.page as string);
  const maxVersions = parseInt(req.query.maxVersions as string);
  const offset = (page - 1) * maxVersions;
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
          if (ownerIdRow.rows.length === 0) return res.status(401).end("Invalid session");
          const ownerId = ownerIdRow.rows[0].owner_id;
          if (userId !== ownerId) return res.status(403).end("You don't have permission to see the version history");
          pool.query(`
            SELECT COUNT(version_id)
            FROM document_versions
            WHERE document_id = $1
            `, [docId], (err, totalRowsRow) => {
              if (err) return res.status(500).end(err);
              if (totalRowsRow.rows.length === 0) return res.status(401).end("Invalid session");
              const totalVersions = parseInt(totalRowsRow.rows[0].count);
              pool.query(`
                SELECT version_id, edited_by, created_at
                FROM document_versions
                WHERE document_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                `, [docId, maxVersions, offset], (err, result) => {
                  if (err) return res.status(500).end(err);
                  res.json({
                    hasPrev: page > 1,
                    hasNext: (page * maxVersions) < totalVersions,
                    documentId: docId,
                    versions: result.rows
                  })
                });
            });
        });
    });
});

// get single version history
app.get("/api/documents/:documentId/versions/:versionId", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  const versionId = req.params.versionId;
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
          if (userId !== ownerId) return res.status(403).end("You don't have permission to view this version");
          pool.query(`
            SELECT *
            FROM document_versions
            WHERE version_id = $1 AND document_id = $2
            `, [versionId, docId], (err, document) => {
              if (err) return res.status(500).end(err);
              if (document.rows.length === 0) {
                return res
                .status(404)
                .end("Document with ID " + docId + " with version ID" + versionId +"does not exist.");
              }
              res.json({
                document: document.rows[0],
              });
            });
        });
    });
});

// get all shares users with their perms (only owner can do this)
app.get("/api/documents/:documentId/shared/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  const page = parseInt(req.query.page as string);
  const maxSharedUsers = parseInt(req.query.maxSharedUsers as string);
  const offset = (page - 1) * maxSharedUsers;
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
      if (userId !== ownerId) return res.status(403).end("You don't have permission to view shared users");
      pool.query(`
        SELECT COUNT(user_id)
        FROM shared_documents
        WHERE document_id = $1 
      `, [docId], (err, totalRowsRow) => {
        if (err) return res.status(500).end(err);
        const totalSharedUsers = parseInt(totalRowsRow.rows[0].count);
        pool.query(`
          SELECT u.name, s.permission, u.email
          FROM users u
          JOIN shared_documents s ON u.id = s.user_id
          WHERE s.document_id = $1
          LIMIT $2 OFFSET $3
        `, [docId, maxSharedUsers, offset], (err, resultRow) => {
          if (err) return res.status(500).end(err);
          res.json({
            shared_users: resultRow.rows,
            hasPrev: page > 1,
            hasNext: (page * maxSharedUsers) < totalSharedUsers,
            document_id: docId,
          });
        });
      });
    });
  });
});

// UPDATE
// update document content (if person has edit access)
app.patch("/api/documents/:documentId/data/content/", isAuthenticated, sanitizeContent, function(req: Request, res: Response, next: NextFunction) {
  if (!req.body.content) return res.status(400).end("Missing title or content");
  const content = req.body.content;
  const docId = parseInt(req.params.documentId);
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).json({ error: err.message });
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      pool.query(`
        SELECT d.document_id, d.content
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR (s.user_id = $2 AND s.permission = 'edit'))
        `, [docId, userId], (err, docResult) => {
          if (err) return res.status(500).json({ error: err.message });
          if (docResult.rows.length === 0) return res.status(403).end("You don't have permission to edit this document");
          const oldDoc = docResult.rows[0];
          // save old version for version history
          pool.query(`
            INSERT INTO document_versions(document_id, edited_by, content)
            VALUES ($1, $2, $3)
            `, [docId, userId, JSON.stringify(oldDoc.content)], (err) => {
              if (err) return res.status(500).json({ error: err.message });
              pool.query(`
                UPDATE documents
                SET content = $1, last_modified = CURRENT_TIMESTAMP
                WHERE document_id = $2
                RETURNING *
                `, [JSON.stringify(content), docId], (err, document) => {
                  if (err) return res.status(500).json({ error: err.message });
                  return res.json({
                    document: document.rows[0]
                  });
                });
            });
        });
    });
});

// update document title (if person has edit access)
app.patch("/api/documents/:documentId/data/title/", isAuthenticated, sanitizeTitle, function(req: Request, res: Response, next: NextFunction) {
  if (!req.body.title) return res.status(400).end("Missing title or content");
  const title = req.body.title;
  const docId = parseInt(req.params.documentId);
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
        `, [docId, userId], (err, docResult) => {
          if (err) return res.status(500).end(err);
          if (docResult.rows.length === 0) return res.status(403).end("You don't have permission to edit this document");
          // update title
          pool.query(`
            UPDATE documents
            SET title = $1, last_modified = CURRENT_TIMESTAMP
            WHERE document_id = $2
            RETURNING title
            `, [title, docId], (err, updateRow) => {
              if (err) return res.status(500).end(err);
              res.json({
                new_title: updateRow.rows[0].title
              })
            });
        });
    });
});

// DELETE
// delete document (only owners can delete)
app.delete("/api/documents/:documentId/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
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
app.delete("/api/documents/:documentId/users/", isAuthenticated, checkEmail, function(req: Request, res: Response, next: NextFunction) {
  if (!('email' in req.body)) return res.status(400).end('email is missing');
  const docId = parseInt(req.params.documentId);
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
// join document
app.get("/api/documents/:documentId/data/join/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      // Check ownership
      pool.query(`
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `, [docId, userId], (err, permsRow) => {
          if (err) return res.status(500).end(err);
          if (permsRow.rows.length === 0) return res.status(403).end("You do not have permission to access this document");
          WebRTCManager.joinRoom(docId, userId, function(offer) {
            if (!offer) return res.status(500).end("Failed to create offer");
            res.json(offer);
          });
        }); 
    });
});

// sdp
app.post("/api/documents/:documentId/data/answer/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  const desc = req.body;;
  if (!desc || !desc.sdp) {
    return res.status(400).json({ error: "Missing SDP data" });
  }
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      // check ownership
      pool.query(`
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `, [docId, userId], (err, permsRow) => {
          if (err) return res.status(500).end(err);
          if (permsRow.rows.length === 0) return res.status(403).end("You do not have permission to access this document");
          const room = WebRTCManager.rooms[docId];
          const user = room.peers.find(p => p.userId === userId);
          if (!user) return res.status(403).end("User not found in room");
          user.peer.setRemoteDescription(new RTCSessionDescription(desc))
            .then(() => res.json({ ok: true }))
            .catch((err: unknown) => res.status(500).end(String(err)));
        }); 
    });
});

// we use post because we need the beacon functionality (doesn't work with get)
app.post("/api/documents/:documentId/data/leave/", isAuthenticated, function(req: Request, res: Response, next: NextFunction) {
  const docId = parseInt(req.params.documentId);
  pool.query(`
    SELECT id
    FROM users
    WHERE email = $1
    `, [req.email], (err, userIdRow) => {
      if (err) return res.status(500).end(err);
      if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
      const userId = userIdRow.rows[0].id;
      // Check ownership
      pool.query(`
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `, [docId, userId], (err, permsRow) => {
          if (err) return res.status(500).end(err);
          if (permsRow.rows.length === 0) return res.status(403).end("You do not have permission to access this document");
          WebRTCManager.leaveRoom(docId, userId);
        }); 
    });
});

export const server = createServer(app);

server.listen(PORT, () => {
  console.log(`✅ HTTP server running on http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error("❌ Server error:", err);
});