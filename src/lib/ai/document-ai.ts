// Requires environment variables:
// - GOOGLE_DOCUMENT_AI_PROJECT_ID
// - GOOGLE_DOCUMENT_AI_LOCATION (e.g. "us" or "eu")
// - GOOGLE_DOCUMENT_AI_PROCESSOR_ID

import type { DocumentAIResult, DocumentTextBlock } from "./types";

export async function extractTextWithDocumentAI(
  pdfBuffer: Buffer
): Promise<DocumentAIResult> {
  const { DocumentProcessorServiceClient } =
    await import("@google-cloud/documentai");

  const projectId = process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID;
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || "us";
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error(
      "Missing GOOGLE_DOCUMENT_AI_PROJECT_ID or GOOGLE_DOCUMENT_AI_PROCESSOR_ID"
    );
  }

  const client = new DocumentProcessorServiceClient();
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: pdfBuffer.toString("base64"),
      mimeType: "application/pdf",
    },
  });

  const document = result.document;
  if (!document) {
    throw new Error("Document AI returned no document");
  }

  const fullText = document.text || "";
  const blocks: DocumentTextBlock[] = [];
  const pageCount = document.pages?.length || 1;

  for (const page of document.pages || []) {
    const pageIndex = page.pageNumber ? page.pageNumber - 1 : 0;

    for (const paragraph of page.paragraphs || []) {
      const textSegments = paragraph.layout?.textAnchor?.textSegments || [];
      let paragraphText = "";

      for (const segment of textSegments) {
        const start = Number(segment.startIndex || 0);
        const end = Number(segment.endIndex || 0);
        paragraphText += fullText.slice(start, end);
      }

      const vertices =
        paragraph.layout?.boundingPoly?.normalizedVertices || [];
      let boundingBox: DocumentTextBlock["boundingBox"];

      if (vertices.length >= 4) {
        const xs = vertices.map((v) => v.x || 0);
        const ys = vertices.map((v) => v.y || 0);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        boundingBox = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }

      if (paragraphText.trim()) {
        blocks.push({
          text: paragraphText.trim(),
          page: pageIndex,
          boundingBox,
        });
      }
    }
  }

  return { fullText, blocks, pageCount };
}
