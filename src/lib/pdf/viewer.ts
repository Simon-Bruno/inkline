import * as pdfjsLib from "pdfjs-dist";

let initialized = false;

export function initPdfJs() {
  if (initialized) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  initialized = true;
}

export async function loadDocument(src: string | ArrayBuffer) {
  initPdfJs();
  const loadingTask = pdfjsLib.getDocument(
    typeof src === "string" ? { url: src } : { data: src }
  );
  return loadingTask.promise;
}

export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
export { pdfjsLib };
