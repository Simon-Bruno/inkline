// Fallback text extraction using pdf-lib (already installed)
// pdf-lib can't extract text directly, so we use the Gemini vision API
// to read the PDF as a document instead.
//
// Simple approach: just send the raw PDF to Gemini and let it extract text + detect fields.

import type { DocumentAIResult } from "./types";
import { PDFDocument } from "pdf-lib";

export async function extractTextFallback(
  pdfBuffer: Buffer
): Promise<DocumentAIResult> {
  // Use pdf-lib just to get page count
  const doc = await PDFDocument.load(pdfBuffer);
  const pageCount = doc.getPageCount();

  // Send the PDF directly to Gemini for text extraction
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBuffer.toString("base64"),
      },
    },
    "Extract all the text content from this PDF document. Return only the raw text, preserving the structure and order. Do not add any commentary.",
  ]);

  const fullText = result.response.text();

  return {
    fullText,
    blocks: [{ text: fullText, page: 0 }],
    pageCount,
  };
}
