// Programmatic field detection using actual PDF text bounding boxes.
// Uses pdf.js-extract to get exact text positions, then finds text items
// containing underscore lines. Classification is done by Gemini (language-agnostic).

import type { AISuggestedField } from "./types";
import {
  classifyDetectedFields,
  type FieldClassificationInput,
  type FieldClassificationResult,
} from "./gemini";

// Field heights as percentage of page
const FIELD_HEIGHTS: Record<string, number> = {
  signature: 3.5,
  name: 3,
  date: 3,
  text: 3,
  initials: 3.5,
  checkbox: 3,
};

/** Raw detected blank (underscore line) before classification. */
interface RawBlank {
  page: number;
  x: number;
  y: number;
  width: number;
  labelText: string;
  nearbySection: string;
}

export interface DetectFieldsDebug {
  inputs: { label: string; section: string }[];
  rawGeminiResponse: string;
  types: string[];
  classificationError?: string;
}

/**
 * Full pipeline: extract text positions from PDF, detect blank fields,
 * then classify them with Gemini for language-agnostic results.
 */
export async function detectFieldsFromPDF(pdfBuffer: Buffer): Promise<{
  fields: AISuggestedField[];
  pageCount: number;
  fullText: string;
  debug?: DetectFieldsDebug;
}> {
  const { PDFExtract } = await import("pdf.js-extract");
  const pdfExtract = new PDFExtract();

  const data = await pdfExtract.extractBuffer(pdfBuffer, {
    normalizeWhitespace: false,
  });

  const blanks: RawBlank[] = [];
  let fullText = "";

  for (let pageIdx = 0; pageIdx < data.pages.length; pageIdx++) {
    const page = data.pages[pageIdx];
    const pageNum = pageIdx + 1;
    const pw = page.pageInfo.width;
    const ph = page.pageInfo.height;

    // Collect full text
    const pageText = page.content.map((item) => item.str).join(" ");
    fullText += pageText + "\n";

    // Find section headings: short lines ending with ":"
    // We don't classify them here — just capture the raw text for Gemini
    interface Section { name: string; y: number }
    const sections: Section[] = [];
    for (const item of page.content) {
      const text = item.str.trim();
      if (!text) continue;
      if (
        text.length <= 40 &&
        text.endsWith(":") &&
        !/_{2,}/.test(text) &&
        /^[A-Z\u00C0-\u024F]/.test(text) // starts with uppercase (including accented)
      ) {
        const name = text.replace(/:$/, "").trim();
        sections.push({ name, y: item.y });
      }
    }

    function getNearestSection(fieldY: number): string {
      let closest: Section | undefined;
      for (const s of sections) {
        if (s.y < fieldY) {
          if (!closest || s.y > closest.y) {
            closest = s;
          }
        }
      }
      return closest?.name ?? "";
    }

    // Find underscore blanks in combined label+underscore items
    for (const item of page.content) {
      const text = item.str;
      if (!text || text.trim().length === 0) continue;

      const underscoreMatch = text.match(/_{3,}/);
      if (!underscoreMatch || underscoreMatch.index === undefined) continue;

      const labelText = text.substring(0, underscoreMatch.index).trim();

      const charsBefore = underscoreMatch.index;
      const totalChars = text.length;
      const ratio = charsBefore / totalChars;
      const underscoreX = item.x + item.width * ratio;
      const underscoreWidth = item.width * (1 - ratio);

      // Default height placeholder — will be set after classification
      const defaultH = 3;

      blanks.push({
        page: pageNum,
        x: (underscoreX / pw) * 100,
        y: (item.y / ph) * 100 - defaultH,
        width: (underscoreWidth / pw) * 100,
        labelText,
        nearbySection: getNearestSection(item.y),
      });
    }

    // Standalone underscore items (separate from their labels)
    for (let i = 0; i < page.content.length; i++) {
      const item = page.content[i];
      const text = item.str.trim();

      if (!text || !/^_{3,}$/.test(text)) continue;

      // Collect ALL text to the left on the same line to form the full label (e.g. "Signature :" or "Name :")
      const yTolerance = 5;
      const leftItems = page.content.filter(
        (c) =>
          Math.abs(c.y - item.y) <= yTolerance &&
          c.x < item.x &&
          c.str.trim().length > 0
      );
      leftItems.sort((a, b) => a.x - b.x);
      const labelText = leftItems.map((c) => c.str.trim()).join(" ").trim();
      const defaultH = 3;

      // Check for duplicates from the combined match above
      const alreadyExists = blanks.some(
        (f) => f.page === pageNum && Math.abs(f.y - ((item.y / ph) * 100 - defaultH)) < 1
      );
      if (alreadyExists) continue;

      blanks.push({
        page: pageNum,
        x: (item.x / pw) * 100,
        y: (item.y / ph) * 100 - defaultH,
        width: (item.width / pw) * 100,
        labelText,
        nearbySection: getNearestSection(item.y),
      });
    }
  }

  // Classify all detected blanks with Gemini (language-agnostic)
  if (blanks.length === 0) {
    return { fields: [], pageCount: data.pages.length, fullText };
  }

  const classificationInputs: FieldClassificationInput[] = blanks.map((b, i) => ({
    index: i,
    labelText: b.labelText,
    nearbySection: b.nearbySection,
    pageNumber: b.page,
  }));

  let classified: FieldClassificationResult[];
  let debug: DetectFieldsDebug | undefined;

  try {
    const out = await classifyDetectedFields(classificationInputs, fullText);
    classified = out.results;
    debug = {
      inputs: classificationInputs.map((c) => ({ label: c.labelText || "(empty)", section: c.nearbySection })),
      rawGeminiResponse: out.rawResponse,
      types: classified.map((c) => c.type),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    classified = blanks.map((_, i) => ({
      index: i,
      type: "text" as const,
      label: "Text",
      role: "",
    }));
    debug = {
      inputs: classificationInputs.map((c) => ({ label: c.labelText || "(empty)", section: c.nearbySection })),
      rawGeminiResponse: "",
      types: classified.map((c) => c.type),
      classificationError: errMsg,
    };
  }

  const fields: AISuggestedField[] = blanks.map((blank, i) => {
    const cls = classified[i] ?? { index: i, type: "text" as const, label: "Text", role: "" };
    const fieldH = FIELD_HEIGHTS[cls.type] || 3;

    // Use the programmatically-detected section heading as the primary role.
    // It's reliable because it comes from actual PDF text positions.
    // Only fall back to Gemini's role guess if no section heading was found.
    const role = blank.nearbySection || cls.role || undefined;

    return {
      type: cls.type,
      page: blank.page,
      x: blank.x,
      y: blank.y - (fieldH - 3), // adjust y offset based on actual field height
      width: blank.width,
      height: fieldH,
      label: cls.label,
      role: role || undefined,
    };
  });

  return {
    fields,
    pageCount: data.pages.length,
    fullText,
    debug,
  };
}
