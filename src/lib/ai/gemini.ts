// Requires environment variable: GEMINI_API_KEY

import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import type { AISuggestedField, AIContractSummary } from "./types";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  return new GoogleGenerativeAI(apiKey);
}

const fieldDetectionSchema: ResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      type: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["signature", "initials", "date", "name", "text", "checkbox"],
      },
      page: { type: SchemaType.NUMBER, description: "1-indexed page number (page 1 = 1, page 2 = 2)" },
      x: {
        type: SchemaType.NUMBER,
        description: "X position as percentage (0-100)",
      },
      y: {
        type: SchemaType.NUMBER,
        description: "Y position as percentage (0-100)",
      },
      width: {
        type: SchemaType.NUMBER,
        description: "Width as percentage (0-100)",
      },
      height: {
        type: SchemaType.NUMBER,
        description: "Height as percentage (0-100)",
      },
      label: {
        type: SchemaType.STRING,
        description: "Human-readable label for the field",
      },
    },
    required: ["type", "page", "x", "y", "width", "height", "label"],
  },
};

const summarySchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    bullets: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "3-5 bullet point summary of the contract",
    },
  },
  required: ["bullets"],
};

export async function detectFields(
  documentText: string,
  pageCount: number,
  pdfBuffer?: Buffer
): Promise<AISuggestedField[]> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: fieldDetectionSchema,
    },
  });

  const prompt = `You are an expert at analyzing contracts and legal documents. Look at this PDF and identify exactly where signers need to fill in fields.

COORDINATE SYSTEM:
- Pages are 1-indexed (first page = 1, second page = 2). This document has ${pageCount} page(s).
- All coordinates are percentages (0-100) of the PAGE dimensions.
- (0, 0) = top-left corner of the page.
- x=0 is the left edge, x=100 is the right edge.
- y=0 is the top edge, y=100 is the bottom edge.

POSITIONING RULES:
- A standard US letter page has left/right margins at roughly x=12 (left margin).
- Labels like "Signature:", "Name:", "Date:", "Title:" typically end around x=20-25.
- The blank fill-in lines (underscores "____") start right after the label, around x=22-28.
- Place each field so it covers the blank underscore line, NOT the label text.
- The field x should be where the underscores START (after the label colon and space).
- The field width should cover the full length of the underscore line.

FIELD SIZES (as page percentages):
- Signature: width ~35, height ~3.5
- Name: width ~35, height ~3
- Date: width ~20, height ~3
- Title/Text: width ~35, height ~3
- Initials: width ~8, height ~3.5
- Checkbox: width ~3, height ~3

WHAT TO DETECT:
- Blank signature lines next to "Signature:" labels
- Blank name lines next to "Name:" labels
- Blank date lines next to "Date:" labels
- Blank title lines next to "Title:" labels
- Any other blank fill-in areas with underscores or dotted lines
- Do NOT place fields on printed text or filled-in content.

Return ONLY fields for blank lines that need filling.`;

  // Send the actual PDF for visual analysis if available
  const parts: Parameters<typeof model.generateContent>[0] = pdfBuffer
    ? [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBuffer.toString("base64"),
          },
        },
        prompt,
      ]
    : [prompt + `\n\nDocument text:\n${documentText}`];

  const result = await model.generateContent(parts);
  const text = result.response.text();
  const fields: AISuggestedField[] = JSON.parse(text);

  // Clamp all coordinates to valid ranges (pages are 1-indexed)
  return fields.map((f) => ({
    ...f,
    page: Math.max(1, Math.min(pageCount, Math.round(f.page))),
    x: Math.max(0, Math.min(100, f.x)),
    y: Math.max(0, Math.min(100, f.y)),
    width: Math.max(1, Math.min(100 - f.x, f.width)),
    height: Math.max(1, Math.min(100 - f.y, f.height)),
  }));
}

const VALID_FIELD_TYPES = ["signature", "initials", "date", "name", "text", "checkbox"] as const;

/**
 * Classify detected blank fields using Gemini.
 * Uses a plain JSON prompt (no response schema) so the model returns the correct types.
 */

export interface FieldClassificationInput {
  index: number;
  labelText: string;
  nearbySection: string;
  pageNumber: number;
}

export interface FieldClassificationResult {
  index: number;
  type: AISuggestedField["type"];
  label: string;
  role: string;
}

export interface ClassifyResult {
  results: FieldClassificationResult[];
  rawResponse: string;
}

export async function classifyDetectedFields(
  inputs: FieldClassificationInput[],
  documentContext: string
): Promise<ClassifyResult> {
  if (inputs.length === 0) {
    return { results: [], rawResponse: "" };
  }

  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const fieldList = inputs
    .map((f) => `${f.index + 1}. label="${f.labelText || "(no label)"}" section="${f.nearbySection}"`)
    .join("\n");

  const prompt = `You classify form fields. For each line below, output ONLY one word: signature, initials, date, name, text, or checkbox.
- Place to sign → signature
- Initials / paraphe → initials
- Date → date
- Person's name → name
- Checkbox → checkbox
- Title, address, other → text
Labels can be in any language. Output exactly one word per line, same order. No numbering, no JSON.

${fieldList}`;

  const result = await model.generateContent(prompt);
  const rawResponse = result.response.text().trim();

  const lines = rawResponse
    .split(/\r?\n/)
    .map((s) => s.replace(/^\d+[.)]\s*/, "").trim().toLowerCase())
    .filter(Boolean);

  function parseTypeFromLine(line: string): FieldClassificationResult["type"] {
    const trimmed = line.trim();
    if (VALID_FIELD_TYPES.includes(trimmed as (typeof VALID_FIELD_TYPES)[number])) {
      return trimmed as FieldClassificationResult["type"];
    }
    const asWord = new RegExp(`\\b(${VALID_FIELD_TYPES.join("|")})\\b`, "i");
    const match = line.match(asWord);
    if (match) return match[1].toLowerCase() as FieldClassificationResult["type"];
    return "text";
  }

  const types: FieldClassificationResult["type"][] = [];
  for (let i = 0; i < inputs.length; i++) {
    types.push(parseTypeFromLine(lines[i] ?? ""));
  }

  const results: FieldClassificationResult[] = inputs.map((inp, i) => ({
    index: inp.index,
    type: types[i] ?? "text",
    label: inp.labelText?.trim() || "Text",
    role: inp.nearbySection || "",
  }));

  return { results, rawResponse };
}

export async function summarizeContract(
  documentText: string
): Promise<AIContractSummary> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: summarySchema,
    },
  });

  const prompt = `You are a legal document analyst. Summarize the following contract in 3-5 concise bullet points in plain English. Focus on:
- What type of document/agreement it is
- Key parties involved
- Main obligations or terms
- Important dates or deadlines
- Notable clauses or conditions

Keep each bullet point to 1-2 sentences. Use simple language that a non-lawyer can understand.

Document text:
${documentText}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const summary: AIContractSummary = JSON.parse(text);

  return summary;
}
