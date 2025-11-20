import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export function extractQuillFromFile(fileBuffer: Buffer, mimetype: string, filename: string, cb: (err: Error | null, delta?: any) => void) {
    const prompt = `
    You convert uploaded PDF or DOCX files into clean, minimal Quill Delta JSON.

    Requirements:
    - Preserve paragraphs, headings, bold, italic, bullet lists, numbered lists, any valid quill delta ops
    - Keep formatting minimal and clean.
    - Do NOT invent or hallucinate any text.
    - Output ONLY a valid Quill Delta JSON object (no markdown, no explanation).
    `;
    openai.responses
        .create({
            model: "gpt-4o-mini-vision",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text", 
                            text: prompt 
                        },
                        {
                            type: "input_file",
                            file_data: fileBuffer.toString("base64"),
                            filename: filename,
                        },
                    ],
                }
            ],
        })
        .then((response) => {
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
        .catch((err) => cb(err));
}