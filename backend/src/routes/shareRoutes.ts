import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { isAuthenticated, checkEmail } from "../middleware/auth";
import { pool } from "../db";
const router = Router();

// get all shares users with their perms (only owner can do this)
router.get(
  "/:documentId/shared/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    const page = parseInt(req.query.page as string);
    const maxSharedUsers = parseInt(req.query.maxSharedUsers as string);
    const offset = (page - 1) * maxSharedUsers;
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
                .end("You don't have permission to view shared users");
            pool.query(
              `
        SELECT COUNT(user_id)
        FROM shared_documents
        WHERE document_id = $1 
      `,
              [docId],
              (err, totalRowsRow) => {
                if (err) return res.status(500).end(err);
                const totalSharedUsers = parseInt(totalRowsRow.rows[0].count);
                pool.query(
                  `
          SELECT u.name, s.permission, u.email
          FROM users u
          JOIN shared_documents s ON u.id = s.user_id
          WHERE s.document_id = $1
          LIMIT $2 OFFSET $3
        `,
                  [docId, maxSharedUsers, offset],
                  (err, resultRow) => {
                    if (err) return res.status(500).end(err);
                    res.json({
                      shared_users: resultRow.rows,
                      hasPrev: page > 1,
                      hasNext: page * maxSharedUsers < totalSharedUsers,
                      document_id: docId,
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

// delete other user from document (sharing)
router.delete(
  "/:documentId/users/",
  isAuthenticated,
  checkEmail,
  function (req: Request, res: Response, next: NextFunction) {
    if (!("email" in req.body)) return res.status(400).end("email is missing");
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
            SELECT id
            FROM users
            WHERE email = $1
            `,
              [req.body.email],
              (err, shareUserIdRow) => {
                if (err) return res.status(500).end(err);
                if (shareUserIdRow.rows.length === 0)
                  return res.status(404).end("User not found");
                const shareUserId = shareUserIdRow.rows[0].id;
                pool.query(
                  `
                DELETE FROM shared_documents
                WHERE document_id = $1 AND user_id = $2
                `,
                  [docId, shareUserId],
                  (err) => {
                    if (err) return res.status(500).end(err);
                    res.json({
                      removedEmail: req.body.email,
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

export default router;