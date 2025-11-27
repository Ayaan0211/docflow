import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { extractQuillFromFile } from "../openai";
import path from "path";
import Delta from 'quill-delta';
import isEqual from "lodash.isequal";
import multer from "multer";
import { isAuthenticated } from "../middleware/auth";
import { sanitizeDocument, sanitizeSharingCredentials, sanitizeContent, sanitizeTitle } from "../middleware/sanitize";
import { pool } from "../db";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function usernameToInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

// CREATE
// make a document
router.post(
  "/user/documents/",
  isAuthenticated,
  sanitizeDocument,
  function (req: Request, res: Response, next: NextFunction) {
    if (!req.body.title || !req.body.content)
      return res.status(400).end("Missing title or content");
    const title = req.body.title;
    const content = req.body.content;
    pool.query(
      `
    SELECT id
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (userIdRow.rows.length === 0)
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        pool.query(
          `
      INSERT INTO documents(owner_id, title, content) 
      VALUES ($1, $2, $3) 
      RETURNING document_id, title, content
      `,
          [userId, title, content],
          (err, result) => {
            if (err) return res.status(500).end(err);
            res.json({
              document: result.rows[0],
            });
          }
        );
      }
    );
  }
);

// upload document
router.post(
  "/user/documents/upload/",
  isAuthenticated,
  upload.single("file"),
  function (req: Request, res: Response, next: NextFunction) {
    if (!req.file) return res.status(400).end("No file uploaded");
    const fileBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    const filename = req.file.originalname;
    const { name: cleanTitle } = path.parse(filename);

    extractQuillFromFile(fileBuffer, mimetype, filename, (err, delta) => {
      if (err) {
        console.error("OpenAI extraction error:", err);
        return res.status(500).json({ error: err.message });
      }
      pool.query(
        `
    SELECT id
    FROM users
    WHERE email = $1
    `,
        [req.email],
        (err, userIdRow) => {
          if (err) return res.status(500).end(err);
          if (userIdRow.rows.length === 0)
            return res.status(500).end("Invalid session");
          const userId = userIdRow.rows[0].id;
          pool.query(
            `
      INSERT INTO documents(owner_id, title, content) 
      VALUES ($1, $2, $3) 
      RETURNING document_id, title, content
      `,
            [userId, cleanTitle, JSON.stringify(delta)],
            (err, result) => {
              if (err) return res.status(500).end(err);
              res.json({
                document: result.rows[0],
              });
            }
          );
        }
      );
    });
  }
);

// share a document
router.post(
  "/user/documents/:documentId/",
  isAuthenticated,
  sanitizeSharingCredentials,
  function (req: Request, res: Response, next: NextFunction) {
    const otherEmail = req.body.email;
    const permission = req.body.permission;
    const docId = parseInt(req.params.documentId);
    if (!["view", "edit"].includes(permission))
      return res.status(400).end("Invalid type of permission");

    pool.query(
      `
    SELECT owner_id
    FROM documents
    WHERE document_id = $1
    `,
      [docId],
      (err, ownerIdRow) => {
        if (err) return res.status(500).end(err);
        if (ownerIdRow.rows.length === 0)
          return res.status(404).end("Document not found");
        const owner_id = ownerIdRow.rows[0].owner_id;
        pool.query(
          `
        SELECT DISTINCT id
        FROM documents
        NATURAL JOIN shared_documents
        WHERE document_id = $1 AND permission = 'edit'
        `,
          [docId],
          (err, sharePermsIdRows) => {
            if (err) return res.status(500).end(err);
            // grab all ids of people currently shared to the doc that can edit and check user that's trying to grant other user is one of them
            const sharePermsIds = sharePermsIdRows.rows.map((row) => row.id);
            sharePermsIds.push(owner_id);
            pool.query(
              `
            SELECT id
            FROM users
            WHERE email = $1
            `,
              [req.email],
              (err, currIdRow) => {
                if (err) return res.status(500).end(err);
                if (currIdRow.rows.length === 0)
                  return res.status(401).end("Invalid session");
                const currId = currIdRow.rows[0].id;
                if (!sharePermsIds.includes(currId))
                  return res
                    .status(403)
                    .end("You don't have permission to share this document");
                pool.query(
                  `
              SELECT id
              FROM users
              WHERE email = $1
              `,
                  [otherEmail],
                  (err, otherUserIdRow) => {
                    if (err) return res.status(500).end(err);
                    if (otherUserIdRow.rows.length === 0)
                      return res
                        .status(400)
                        .end(
                          `Invalid, email, ${otherEmail}, is not a valid user`
                        );
                    const otherUserId = otherUserIdRow.rows[0].id;
                    pool.query(
                      `
                  INSERT INTO shared_documents(document_id, user_id, permission)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (document_id, user_id)
                  DO UPDATE SET permission = EXCLUDED.permission
                  RETURNING *
                  `,
                      [docId, otherUserId, permission],
                      (err, result) => {
                        if (err) return res.status(500).end(err);
                        res.json({
                          result: result.rows[0],
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

// get documents paginated
router.get(
  "/user/documents/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const page = parseInt(req.query.page as string);
    const maxDocuments = parseInt(req.query.maxDocuments as string);
    const offset = (page - 1) * maxDocuments;
    pool.query(
      `
    SELECT id
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (err) return res.status(500).end(err);
        if (userIdRow.rows.length === 0)
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        pool.query(
          `
        SELECT COUNT(DISTINCT d.document_id)
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id
        WHERE d.owner_id = $1 OR s.user_id = $1 
        `,
          [userId],
          (err, totalDocumentsRow) => {
            if (err) return res.status(500).end(err);
            const totalDocuments = parseInt(totalDocumentsRow.rows[0].count);
            pool.query(
              `
            SELECT DISTINCT d.document_id, d.owner_id, d.title, d.last_modified, u.name as owner_name, CASE WHEN d.owner_id = $1 THEN 'owner' else s.permission END as permission
            FROM documents d
            JOIN users u ON d.owner_id = u.id
            LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $1
            WHERE d.owner_id = $1 OR s.user_id = $1
            ORDER BY last_modified DESC
            LIMIT $2 OFFSET $3
            `,
              [userId, maxDocuments, offset],
              (err, result) => {
                if (err) return res.status(500).end(err);
                res.json({
                  hasPrev: page > 1,
                  hasNext: page * maxDocuments < totalDocuments,
                  documents: result.rows,
                });
              }
            );
          }
        );
      }
    );
  }
);

// get single document
router.get(
  "/documents/:documentId/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    pool.query(
      `
    SELECT id, name
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (err) return res.status(500).end(err);
        if (userIdRow.rows.length === 0)
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        const name = userIdRow.rows[0].name;
        pool.query(
          `
        SELECT d.*, s.permission
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `,
          [docId, userId],
          (err, result) => {
            if (err) return res.status(500).end(err);
            if (result.rows.length === 0)
              return res
                .status(403)
                .end("You do not have access to this document");
            const doc = result.rows[0];
            const canEdit = doc.owner_id === userId || doc.permission === "edit";
            const isOwner = doc.owner_id === userId;
            res.json({
              document: doc,
              canEdit,
              initials: usernameToInitials(name),
              isOwner
            });
          }
        );
      }
    );
  }
);

// update document content (if person has edit access)
router.patch(
  "/documents/:documentId/data/content/",
  isAuthenticated,
  sanitizeContent,
  function (req: Request, res: Response, next: NextFunction) {
    if (!req.body.content)
      return res.status(400).end("Missing title or content");
    const content = req.body.content;
    const docId = parseInt(req.params.documentId);
    pool.query(
      `
    SELECT id
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (userIdRow.rows.length === 0)
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        pool.query(
          `
        SELECT d.document_id, d.content
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR (s.user_id = $2 AND s.permission = 'edit'))
        `,
          [docId, userId],
          (err, docResult) => {
            if (err) return res.status(500).json({ error: err.message });
            if (docResult.rows.length === 0)
              return res
                .status(403)
                .end("You don't have permission to edit this document");
            const oldDoc = JSON.stringify(docResult.rows[0].content);
            const newContent = JSON.stringify(content);
            const oldDelta = new Delta(docResult.rows[0].content).ops;
            const newDelta = new Delta(content).ops;
            if (!isEqual(oldDelta, newDelta)) {
              // save old version for version history
            pool.query(
              `
              INSERT INTO document_versions(document_id, edited_by, content)
              VALUES ($1, $2, $3)
              `,
                [docId, userId, oldDoc],
                (err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  pool.query(
                    `
                  UPDATE documents
                  SET content = $1, last_modified = CURRENT_TIMESTAMP
                  WHERE document_id = $2
                  RETURNING *
                  `,
                    [newContent, docId],
                    (err, document) => {
                      if (err)
                        return res.status(500).json({ error: err.message });
                      return res.json({
                        document: document.rows[0],
                      });
                    }
                  );
                }
              );
            } else {
              return res.json({
                        document: docResult.rows[0],
                      });
            }
          }
        );
      }
    );
  }
);

// update document title (if person has edit access)
router.patch(
  "/documents/:documentId/data/title/",
  isAuthenticated,
  sanitizeTitle,
  function (req: Request, res: Response, next: NextFunction) {
    if (!req.body.title) return res.status(400).end("Missing title or content");
    const title = req.body.title;
    const docId = parseInt(req.params.documentId);
    pool.query(
      `
    SELECT id
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (err) return res.status(500).end(err);
        if (userIdRow.rows.length === 0)
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        pool.query(
          `
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR (s.user_id = $2 AND s.permission = 'edit'))
        `,
          [docId, userId],
          (err, docResult) => {
            if (err) return res.status(500).end(err);
            if (docResult.rows.length === 0)
              return res
                .status(403)
                .end("You don't have permission to edit this document");
            // update title
            pool.query(
              `
            UPDATE documents
            SET title = $1, last_modified = CURRENT_TIMESTAMP
            WHERE document_id = $2
            RETURNING title
            `,
              [title, docId],
              (err, updateRow) => {
                if (err) return res.status(500).end(err);
                res.json({
                  new_title: updateRow.rows[0].title,
                });
              }
            );
          }
        );
      }
    );
  }
);

// DELETE
// delete document (only owners can delete)
router.delete(
  "/documents/:documentId/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    pool.query(
      `
    SELECT id
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (err) return res.status(500).end(err);
        if (userIdRow.rows.length === 0)
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        pool.query(
          `
        SELECT owner_id
        FROM documents
        WHERE document_id = $1
        `,
          [docId],
          (err, ownerIdRow) => {
            if (err) return res.status(500).end(err);
            if (ownerIdRow.rows.length === 0)
              return res.status(404).end("Document not found");
            const ownerId = ownerIdRow.rows[0].owner_id;
            if (userId !== ownerId)
              return res
                .status(403)
                .end("You don't have permission to delete this document");
            pool.query(
              `
            DELETE FROM documents
            WHERE document_id = $1
            RETURNING title
            `,
              [docId],
              (err, result) => {
                if (err) return res.status(500).end(err);
                res.json({
                  document: result.rows[0],
                });
              }
            );
          }
        );
      }
    );
  }
);

export default router;