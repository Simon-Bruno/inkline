"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PenTool, Type, Eraser } from "lucide-react";

type Mode = "draw" | "type";

const INK_LIGHT = "#1a1a2e";
const INK_DARK = "#ffffff";
const CANVAS_BG_LIGHT = "#ffffff";
const CANVAS_BG_DARK = "#27272a";

// Script fonts for typed signatures — cycles through styles
const SCRIPT_FONTS = [
  { family: "'Dancing Script', cursive", weight: 700 },
  { family: "'Great Vibes', cursive", weight: 400 },
  { family: "'Caveat', cursive", weight: 700 },
  { family: "'Sacramento', cursive", weight: 400 },
];

// Google Fonts URL for script fonts
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Dancing+Script:wght@700&family=Great+Vibes&family=Sacramento&display=swap";

interface Point {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

interface SignaturePadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dataUrl: string) => void;
  signerName?: string;
}

export function SignaturePad({
  open,
  onOpenChange,
  onConfirm,
  signerName = "",
}: SignaturePadProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [mode, setMode] = useState<Mode>("draw");
  const [typedName, setTypedName] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(0);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasDrawn = useRef(false);
  const [hasDrawnState, setHasDrawnState] = useState(false);
  const points = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);

  const inkColor = isDark ? INK_DARK : INK_LIGHT;
  const canvasBg = isDark ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    setHasDrawnState(false);
    points.current = [];
    lastPoint.current = null;
  }, [canvasBg]);

  // Load Google Fonts
  useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.querySelector(`link[href="${FONTS_URL}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_URL;
      document.head.appendChild(link);
      link.onload = () => setFontsLoaded(true);
    } else {
      setFontsLoaded(true);
    }
  }, []);

  // Reset state when dialog opens or theme changes
  useEffect(() => {
    if (open) {
      hasDrawn.current = false;
      setHasDrawnState(false);
      points.current = [];
      lastPoint.current = null;
      setTypedName(signerName);
      setTimeout(() => clearCanvas(), 50);
    }
  }, [open, signerName, canvasBg, clearCanvas]);

  function getCanvasPoint(e: React.PointerEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure || 0.5,
      time: Date.now(),
    };
  }

  // Calculate line width based on speed (faster = thinner, like a real pen)
  function getStrokeWidth(p1: Point, p2: Point): number {
    const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const dt = Math.max(p2.time - p1.time, 1);
    const speed = dist / dt;

    // Use pressure if available (tablet/stylus), otherwise derive from speed
    const pressureFactor = p2.pressure > 0 && p2.pressure < 1 ? p2.pressure : 1;

    // Base width 3px, thins at high speed, thickens with pressure
    const minWidth = 1.2;
    const maxWidth = 4.5;
    const speedWidth = maxWidth - Math.min(speed * 1.5, maxWidth - minWidth);
    return Math.max(minWidth, Math.min(maxWidth, speedWidth * pressureFactor));
  }

  const startDraw = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    hasDrawn.current = true;
    setHasDrawnState(true);
    const point = getCanvasPoint(e);
    points.current = [point];
    lastPoint.current = point;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const draw = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const point = getCanvasPoint(e);
    const prev = lastPoint.current;
    if (!prev) return;

    const width = getStrokeWidth(prev, point);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.quadraticCurveTo(prev.x, prev.y, point.x, point.y);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPoint.current = point;
    points.current.push(point);
  }, [inkColor]);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  function renderTypedSignature(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const font = SCRIPT_FONTS[selectedFont];
    const name = typedName.trim();

    // Measure and scale to fit
    ctx.font = `${font.weight} 72px ${font.family}`;
    const measured = ctx.measureText(name);
    const maxWidth = canvas.width - 40;
    const fontSize = measured.width > maxWidth
      ? Math.floor(72 * (maxWidth / measured.width))
      : 72;

    ctx.font = `${font.weight} ${fontSize}px ${font.family}`;
    ctx.fillStyle = inkColor;
    ctx.textBaseline = "middle";
    ctx.fillText(name, 20, canvas.height / 2 + 4);

    return canvas.toDataURL("image/png");
  }

  /** Convert white/light signature to dark ink so it looks good on documents. */
  function toDarkInkDataUrl(dataUrl: string): string {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    return new Promise<string>((resolve) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const a = d[i + 3];
          const brightness = (r + g + b) / 3;
          if (a < 10) continue;
          if (brightness > 180) {
            d[i] = 26;
            d[i + 1] = 26;
            d[i + 2] = 46;
          } else {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(id, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = dataUrl;
    });
  }

  async function handleConfirm() {
    let dataUrl: string;
    if (mode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn.current) return;
      dataUrl = trimCanvas(canvas);
    } else {
      if (!typedName.trim()) return;
      dataUrl = renderTypedSignature();
    }
    if (isDark) {
      dataUrl = await toDarkInkDataUrl(dataUrl);
    }
    onConfirm(dataUrl);
    onOpenChange(false);
  }

  // Trim transparent pixels from canvas edges for a tighter signature
  function trimCanvas(source: HTMLCanvasElement): string {
    const ctx = source.getContext("2d")!;
    const { width, height } = source;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    let top = height, bottom = 0, left = width, right = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }

    if (top >= bottom || left >= right) {
      return source.toDataURL("image/png");
    }

    const pad = 10;
    const trimmed = document.createElement("canvas");
    const tw = right - left + pad * 2;
    const th = bottom - top + pad * 2;
    trimmed.width = tw;
    trimmed.height = th;
    const tCtx = trimmed.getContext("2d")!;
    tCtx.drawImage(source, left - pad, top - pad, tw, th, 0, 0, tw, th);
    return trimmed.toDataURL("image/png");
  }

  const canConfirm =
    mode === "draw" ? hasDrawnState : typedName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Your Signature</DialogTitle>
          <DialogDescription>
            {mode === "draw"
              ? "Draw your signature below using your mouse or finger."
              : "Type your name and choose a style."}
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "draw"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("draw")}
          >
            <PenTool className="h-3.5 w-3.5" />
            Draw
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "type"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("type")}
          >
            <Type className="h-3.5 w-3.5" />
            Type
          </button>
        </div>

        {mode === "draw" ? (
          <div className="space-y-2">
            <div className="relative rounded-xl border border-border bg-muted/30">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="relative z-0 block w-full cursor-crosshair touch-none"
                style={{ height: 180 }}
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
              {/* Signature line: dark gray (light mode), white (dark mode) */}
              <div
                className="pointer-events-none absolute left-4 right-4 z-10 bg-zinc-600 dark:bg-white"
                style={{ bottom: 32, height: 2 }}
                aria-hidden
              />
              <div className="pointer-events-none absolute bottom-2 left-4 z-10 text-[10px] text-muted-foreground">
                Sign above the line
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="gap-1.5 text-muted-foreground"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              placeholder="Type your full name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoFocus
              className="text-base"
            />
            {typedName.trim() && (
              <div className="space-y-2">
                {SCRIPT_FONTS.map((font, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedFont(i)}
                    className={`flex w-full items-center justify-center rounded-xl border-2 bg-muted/30 px-6 py-5 transition-all ${
                      selectedFont === i
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <span
                      className="text-3xl text-foreground"
                      style={{
                        fontFamily: font.family,
                        fontWeight: font.weight,
                      }}
                    >
                      {typedName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Adopt Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
