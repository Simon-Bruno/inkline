"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadDocument, type PDFDocumentProxy } from "@/lib/pdf/viewer";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export interface PageDimensions {
  width: number;
  height: number;
}

interface PdfViewerProps {
  src: string;
  className?: string;
  renderPageOverlay?: (pageNumber: number, dimensions: PageDimensions) => React.ReactNode;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

function PdfViewerInner({ src, className, renderPageOverlay }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pageDimensions, setPageDimensions] = useState<Map<number, PageDimensions>>(new Map());

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadDocument(src)
      .then((doc) => {
        if (!cancelled) {
          setPdfDoc(doc);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load PDF:", err);
          setError("Failed to load PDF document");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Fit to container width
  const fitWidth = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) return;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    const newScale = containerWidth / viewport.width;
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale)));
  }, [pdfDoc]);

  // Fit width on load and resize
  useEffect(() => {
    if (!pdfDoc) return;
    fitWidth();
    const observer = new ResizeObserver(() => fitWidth());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pdfDoc, fitWidth]);

  // Track in-flight render tasks so we can cancel them
  const renderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());

  // Render pages when scale or document changes
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;

    // Cancel any in-flight renders
    renderTasksRef.current.forEach((task) => task.cancel());
    renderTasksRef.current.clear();

    async function renderPages() {
      if (!pdfDoc) return;
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) break;
        const page = await pdfDoc.getPage(i);
        if (cancelled) break;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current.get(i);
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        canvas.width = viewport.width * window.devicePixelRatio;
        canvas.height = viewport.height * window.devicePixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

        setPageDimensions(prev => {
          const next = new Map(prev);
          next.set(i, { width: viewport.width, height: viewport.height });
          return next;
        });

        const renderTask = page.render({ canvasContext: ctx, canvas, viewport });
        renderTasksRef.current.set(i, { cancel: () => renderTask.cancel() });

        try {
          await renderTask.promise;
        } catch (err: unknown) {
          // Ignore cancellation errors
          if (err instanceof Error && err.message.includes("Rendering cancelled")) continue;
          throw err;
        } finally {
          renderTasksRef.current.delete(i);
        }
      }
    }

    renderPages();
    return () => {
      cancelled = true;
      renderTasksRef.current.forEach((task) => task.cancel());
      renderTasksRef.current.clear();
    };
  }, [pdfDoc, scale]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));

  if (error) {
    return (
      <div className="flex items-center justify-center p-16 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="text-sm text-muted-foreground">
          {pdfDoc ? `${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? "" : "s"}` : ""}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= MIN_SCALE}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[4rem] text-center text-sm text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= MAX_SCALE}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fitWidth}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF pages */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/20 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading document...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {pdfDoc &&
              Array.from({ length: pdfDoc.numPages }, (_, i) => (
                <div key={i + 1} className="relative shadow-md">
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current.set(i + 1, el);
                      else canvasRefs.current.delete(i + 1);
                    }}
                  />
                  {renderPageOverlay && pageDimensions.get(i + 1) && (
                    <div className="absolute inset-0" style={{ pointerEvents: "auto" }}>
                      {renderPageOverlay(i + 1, pageDimensions.get(i + 1)!)}
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                    {i + 1}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfViewerInner;
