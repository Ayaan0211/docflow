import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../middleware/auth";
import { pool } from "../db";
import * as WebRTCManager from "../webRTCManager"
const router = Router();

// join document
router.get(
  "/:documentId/data/join/",
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
        // Check ownership
        pool.query(
          `
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `,
          [docId, userId],
          (err, permsRow) => {
            if (err) return res.status(500).end(err);
            if (permsRow.rows.length === 0)
              return res
                .status(403)
                .end("You do not have permission to access this document");
            WebRTCManager.joinRoom(docId, userId, function (offer) {
              if (!offer) return res.status(500).end("Failed to create offer");
              res.json(offer);
            });
          }
        );
      }
    );
  }
);

// sdp
router.post(
  "/:documentId/data/answer/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    const desc = req.body;
    if (!desc || !desc.sdp) {
      return res.status(400).json({ error: "Missing SDP data" });
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
          return res.status(401).end("Invalid session");
        const userId = userIdRow.rows[0].id;
        // check ownership
        pool.query(
          `
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `,
          [docId, userId],
          (err, permsRow) => {
            if (err) return res.status(500).end(err);
            if (permsRow.rows.length === 0)
              return res
                .status(403)
                .end("You do not have permission to access this document");
            const room = WebRTCManager.rooms[docId];
            const user = room.peers.find((p) => p.userId === userId);
            if (!user) return res.status(403).end("User not found in room");
            user.peer
              .setRemoteDescription(new RTCSessionDescription(desc))
              .then(() => res.json({ ok: true }))
              .catch((err: unknown) => res.status(500).end(String(err)));
          }
        );
      }
    );
  }
);

// leave, we use post because we need the beacon functionality (doesn't work with get)
router.post(
  "/:documentId/data/leave/",
  isAuthenticated,
  function (req: Request, res: Response, next: NextFunction) {
    res.status(204).end();
    const docId = parseInt(req.params.documentId);
    pool.query(
      `
    SELECT id
    FROM users
    WHERE email = $1
    `,
      [req.email],
      (err, userIdRow) => {
        if (err) {
          console.warn("Leave route: user lookup failed", err);
          return;
        };
        if (userIdRow.rows.length === 0) {
          console.warn("Leave route: user lookup failed");
          return;
        }
        const userId = userIdRow.rows[0].id;
        // Check ownership
        pool.query(
          `
        SELECT 1
        FROM documents d
        LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
        WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
        `,
          [docId, userId],
          (err, permsRow) => {
            if (err) {
               console.warn("Leave route: perms lookup failed", err);
               return;
            }
            if (permsRow.rows.length === 0) {
              console.warn("Leave route: perms lookup failed",);
            }
            WebRTCManager.leaveRoom(docId, userId);
          }
        );
      }
    );
  }
);

export default router;