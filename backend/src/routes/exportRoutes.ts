import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { isAuthenticated } from "../middleware/auth";
import { pool } from "../db";
const router = Router();

// Export document as PDF
router.get(
  "/:documentId/export/pdf",
  isAuthenticated,
  async function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    
    try {
      pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [req.email],
        (err, userIdRow) => {
          if (err) return res.status(500).end(err.message);
          if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
          
          const userId = userIdRow.rows[0].id;
          
          pool.query(
            `
            SELECT d.*, s.permission
            FROM documents d
            LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
            WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
            `,
            [docId, userId],
            (err, result) => {
              if (err) return res.status(500).end(err.message);
              if (result.rows.length === 0)
                return res.status(403).end("You do not have access to this document");
              
              const doc = result.rows[0];
              
              // Create PDF
              const pdfDoc = new PDFDocument();
              
              res.setHeader('Content-Type', 'routerlication/pdf');
              res.setHeader('Content-Disposition', `attachment; filename="${doc.title}.pdf"`);
              
              pdfDoc.pipe(res);
              
              // Add title
              pdfDoc.fontSize(20).text(doc.title, { align: 'center' });
              pdfDoc.moveDown();
              
              // Convert Quill delta to text
              if (doc.content && doc.content.ops) {
                doc.content.ops.forEach((op: any) => {
                  if (typeof op.insert === 'string') {
                    pdfDoc.fontSize(12).text(op.insert);
                  }
                });
              }
              
              pdfDoc.end();
            }
          );
        }
      );
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).end('Failed to export PDF');
    }
  }
);

// Export document as DOCX
router.get(
  "/:documentId/export/docx",
  isAuthenticated,
  async function (req: Request, res: Response, next: NextFunction) {
    const docId = parseInt(req.params.documentId);
    
    try {
      pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [req.email],
        (err, userIdRow) => {
          if (err) return res.status(500).end(err.message);
          if (userIdRow.rows.length === 0) return res.status(401).end("Invalid session");
          
          const userId = userIdRow.rows[0].id;
          
          pool.query(
            `
            SELECT d.*, s.permission
            FROM documents d
            LEFT JOIN shared_documents s ON d.document_id = s.document_id AND s.user_id = $2
            WHERE d.document_id = $1 AND (d.owner_id = $2 OR s.user_id = $2)
            `,
            [docId, userId],
            async (err, result) => {
              if (err) return res.status(500).end(err.message);
              if (result.rows.length === 0)
                return res.status(403).end("You do not have access to this document");
              
              const docData = result.rows[0];
              
              // Convert Quill delta to paragraphs
              const paragraphs: Paragraph[] = [];
              
              // Add title
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: docData.title,
                      bold: true,
                      size: 32,
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );
              
              // Convert content
              if (docData.content && docData.content.ops) {
                docData.content.ops.forEach((op: any) => {
                  if (typeof op.insert === 'string') {
                    const textRun = new TextRun({
                      text: op.insert,
                      bold: op.attributes?.bold,
                      italics: op.attributes?.italic,
                      underline: op.attributes?.underline ? {} : undefined,
                    });
                    
                    paragraphs.push(
                      new Paragraph({
                        children: [textRun],
                      })
                    );
                  }
                });
              }
              
              // Create DOCX document
              const doc = new Document({
                sections: [
                  {
                    properties: {},
                    children: paragraphs,
                  },
                ],
              });
              
              // Generate buffer
              const buffer = await Packer.toBuffer(doc);
              
              res.setHeader('Content-Type', 'routerlication/vnd.openxmlformats-officedocument.wordprocessingml.document');
              res.setHeader('Content-Disposition', `attachment; filename="${docData.title}.docx"`);
              res.send(buffer);
            }
          );
        }
      );
    } catch (error) {
      console.error('DOCX export error:', error);
      res.status(500).end('Failed to export DOCX');
    }
  }
);

export default router;