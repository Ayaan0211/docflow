import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import Delta from 'quill-delta';
import { isAuthenticated } from "../middleware/auth";
import { pool } from "../db";
import * as WebRTCManager from "../webRTCManager"
const router = Router();


// restore a specifc version (only owners can restore a version)
router.post(
  "/:documentId/versions/:versionId",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    const versionId = req.params.versionId;
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
              return res.status(401).end("Invalid session");
            const ownerId = ownerIdRow.rows[0].owner_id;
            if (userId !== ownerId)
              return res
                .status(403)
                .end("You don't have permission to restore this version");
            // save current version of the document and then restore the specififed version
            pool.query(
              `
            SELECT content
            FROM document_versions
            WHERE version_id = $1
            `,
              [versionId],
              (err, versionRow) => {
                if (err) return res.status(500).end(err);
                if (versionRow.rows.length === 0)
                  return res.status(400).end("Version not found");
                const version_content = versionRow.rows[0].content;
                pool.query(
                  `
                SELECT content
                FROM documents
                WHERE document_id = $1
                `,
                  [docId],
                  (err, currentDocumentRow) => {
                    if (err) return res.status(500).end(err);
                    if (currentDocumentRow.rows.length === 0)
                      return res.status(400).end("Document not found");
                    const curr_content = currentDocumentRow.rows[0].content;
                    pool.query(
                      `
                    INSERT INTO document_versions(document_id, edited_by, content)
                    VALUES ($1, $2, $3)
                    `,
                      [docId, userId, curr_content],
                      (err) => {
                        if (err) return res.status(500).end(err);
                        pool.query(
                          `
                        UPDATE documents
                        SET content = $1, last_modified = CURRENT_TIMESTAMP
                        WHERE document_id = $2
                        RETURNING *
                        `,
                          [version_content, docId],
                          (err, updatedDoc) => {
                            if (err) return res.status(500).end(err);
                            if (WebRTCManager.rooms[docId]) {
                              const parsed = version_content;
                              const room = WebRTCManager.rooms[docId];
                              room.docState = new Delta(parsed);
                              room.ops = [];
                              room.version = 0;
                              for (const p of room.peers) {
                                if (p.dataChannel?.readyState !== "open") continue;
                                p.dataChannel.send(JSON.stringify({
                                    type: 'snapshot',
                                    content: room.docState,
                                    version: 0
                                }));
                              }
                            }
                            res.json({
                              document: updatedDoc.rows[0],
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
  }
);

// get version history paginated, only owner should see document history
router.get(
  "/:documentId/versions/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    const page = parseInt(req.query.page as string);
    const maxVersions = parseInt(req.query.maxVersions as string);
    const offset = (page - 1) * maxVersions;
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
              return res.status(401).end("Invalid session");
            const ownerId = ownerIdRow.rows[0].owner_id;
            if (userId !== ownerId)
              return res
                .status(403)
                .end("You don't have permission to see the version history");
            pool.query(
              `
            SELECT COUNT(version_id)
            FROM document_versions
            WHERE document_id = $1
            `,
              [docId],
              (err, totalRowsRow) => {
                if (err) return res.status(500).end(err);
                if (totalRowsRow.rows.length === 0)
                  return res.status(401).end("Invalid session");
                const totalVersions = parseInt(totalRowsRow.rows[0].count);
                pool.query(
                  `
                SELECT *
                FROM (
                  SELECT version_id, edited_by, created_at, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at ASC) AS version_number
                  FROM document_versions
                  WHERE document_id = $1
                ) AS t
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                `,
                  [docId, maxVersions, offset],
                  (err, result) => {
                    if (err) return res.status(500).end(err);
                    res.json({
                      hasPrev: page > 1,
                      hasNext: page * maxVersions < totalVersions,
                      documentId: docId,
                      versions: result.rows,
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

// get single version history
router.get(
  "/:documentId/versions/:versionId",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    const versionId = req.params.versionId;
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
                .end("You don't have permission to view this version");
              pool.query(
                `
              SELECT *
              FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at ASC) AS version_number
                FROM document_versions
                WHERE document_id = $2
              ) AS t
              WHERE version_id = $1
              `,
                [versionId, docId],
                (err, document) => {
                  if (err) return res.status(500).end(err);
                  if (document.rows.length === 0) {
                    return res
                      .status(404)
                      .end(
                        "Document with ID " +
                          docId +
                          " with version ID" +
                          versionId +
                          "does not exist."
                      );
                  }
                  res.json({
                    document: document.rows[0],
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