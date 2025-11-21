import OpenAI from "openai";
import fs from "fs";
import path from "path";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export function extractQuillFromFile(
  fileBuffer: Buffer,
  mimetype: string,
  filename: string,
  cb: (err: Error | null, delta?: any) => void
) {
  const prompt = `
    You convert uploaded PDF or DOCX files into clean, minimal Quill Delta JSON.

    Requirements:
    - Preserve paragraphs, headings, bold, italic, bullet lists, numbered lists, any valid quill delta ops
    - Keep formatting minimal and clean.
    - Do NOT invent or hallucinate any text.
    - Output ONLY a valid Quill Delta JSON object (no markdown, no explanation).
    `;
  const tempPath = path.join("/tmp", `${Date.now()}-${filename}`);
  fs.writeFile(tempPath, fileBuffer, (err) => {
    if (err) return cb(err);
    openai.files
      .create({
        file: fs.createReadStream(tempPath),
        purpose: "user_data",
      })
      .then((uploadedFile) => {
        return openai.responses.create({
          model: "gpt-4o",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                { type: "input_file", file_id: uploadedFile.id },
              ],
            },
          ],
        });
      })
      .then((response) => {
        fs.unlink(tempPath, () => {});
        let raw = response.output_text?.trim();
        if (!raw) {
          return cb(new Error("No output from model"));
        }
        try {
          const delta = JSON.parse(raw);
          cb(null, delta);
        } catch (err) {
          cb(new Error("GPT returned invalid JSON: " + raw));
        }
      })
      .catch((err) => {
        fs.unlink(tempPath, () => {});
        cb(err);
      });
  });
}
