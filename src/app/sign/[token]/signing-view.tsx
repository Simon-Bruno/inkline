"use client";

import { useState, useCallback } from "react";
import { PdfViewer } from "@/components/pdf/pdf-viewer-dynamic";
import type { PageDimensions } from "@/components/pdf/pdf-viewer";
import { SignaturePad } from "@/components/signing/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, PenTool, Calendar, User, Hash, Type, CheckSquare } from "lucide-react";

interface SigningField {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isRequired: boolean;
  value: string | null;
}

interface SigningViewProps {
  accessToken: string;
  signer: { id: string; name: string; email: string };
  document: { id: string; title: string; message: string | null };
  fields: SigningField[];
  pdfUrl: string;
}

const FIELD_ICONS: Record<string, React.ElementType> = {
  signature: PenTool,
  initials: Hash,
  date: Calendar,
  name: User,
  text: Type,
  checkbox: CheckSquare,
};

export function SigningView({
  accessToken,
  signer,
  document: doc,
  fields: initialFields,
  pdfUrl,
}: SigningViewProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of initialFields) {
      const t = (f.type ?? "").toLowerCase();
      if (f.value) {
        initial[f.id] = f.value;
      } else if (t === "name") {
        initial[f.id] = signer.name;
      } else if (t === "date") {
        initial[f.id] = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } else if (t === "checkbox") {
        initial[f.id] = "";
      } else {
        initial[f.id] = "";
      }
    }
    return initial;
  });

  const [sigPadOpen, setSigPadOpen] = useState(false);
  const [sigPadFieldId, setSigPadFieldId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = initialFields.filter((f) => {
    const val = fieldValues[f.id];
    const t = (f.type ?? "").toLowerCase();
    if (t === "checkbox") return val === "true";
    return val && val.trim().length > 0;
  }).length;
  const totalRequired = initialFields.filter((f) => f.isRequired).length;
  const requiredFilled = initialFields.filter((f) => {
    if (!f.isRequired) return true;
    const val = fieldValues[f.id];
    const t = (f.type ?? "").toLowerCase();
    if (t === "checkbox") return val === "true";
    return val && val.trim().length > 0;
  }).length;
  const canSubmit = requiredFilled === initialFields.filter((f) => f.isRequired).length;

  function openSignaturePad(fieldId: string) {
    setSigPadFieldId(fieldId);
    setSigPadOpen(true);
  }

  function handleSignatureConfirm(dataUrl: string) {
    if (sigPadFieldId) {
      setFieldValues((prev) => ({ ...prev, [sigPadFieldId]: dataUrl }));
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          fieldValues: initialFields.map((f) => ({
            fieldId: f.id,
            value: fieldValues[f.id] || "",
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit signature");
        setSubmitting(false);
        return;
      }

      setCompleted(true);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const renderPageOverlay = useCallback(
    (pageNumber: number, dimensions: PageDimensions) => {
      const pageFields = initialFields.filter((f) => f.page === pageNumber);
      if (pageFields.length === 0) return null;

      return (
        <div className="relative h-full w-full">
          {pageFields.map((field) => {
            const pxLeft = (field.x / 100) * dimensions.width;
            const pxTop = (field.y / 100) * dimensions.height;
            const pxWidth = (field.width / 100) * dimensions.width;
            const pxHeight = (field.height / 100) * dimensions.height;
            const value = fieldValues[field.id] || "";
            const fieldType = (field.type ?? "").toLowerCase();
            const isSignatureField = fieldType === "signature" || fieldType === "initials";
            const Icon = FIELD_ICONS[fieldType] || FIELD_ICONS[field.type] || Type;
            const isFilled = fieldType === "checkbox" ? value === "true" : value.trim().length > 0;

            const fontSize = Math.max(11, Math.min(pxHeight * 0.55, 16));

            return (
              <div
                key={field.id}
                className="absolute"
                style={{
                  left: pxLeft,
                  top: pxTop,
                  width: pxWidth,
                  height: pxHeight,
                  zIndex: 10,
                }}
              >
                {isSignatureField ? (
                  <button
                    type="button"
                    className="flex h-full w-full items-end justify-center overflow-hidden transition-all"
                    style={{
                      border: isFilled ? "none" : "2px dashed #60a5fa",
                      backgroundColor: isFilled ? "transparent" : "rgba(219,234,254,0.6)",
                      borderRadius: 3,
                    }}
                    onClick={() => openSignaturePad(field.id)}
                  >
                    {isFilled ? (
                      <img
                        src={value}
                        alt={fieldType}
                        className="h-full w-full object-contain object-bottom"
                      />
                    ) : (
                      <span
                        className="flex items-center gap-1.5"
                        style={{ fontSize: Math.max(11, fontSize * 0.75), color: "#2563eb" }}
                      >
                        <Icon style={{ width: fontSize * 0.65, height: fontSize * 0.65 }} />
                        {fieldType === "signature"
                          ? "Click to sign"
                          : "Click to initial"}
                      </span>
                    )}
                  </button>
                ) : fieldType === "checkbox" ? (
                  <label
                    className="flex h-full w-full cursor-pointer items-center justify-center"
                    style={{
                      border: isFilled ? "none" : "2px dashed #60a5fa",
                      backgroundColor: isFilled ? "transparent" : "rgba(219,234,254,0.6)",
                      borderRadius: 3,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={value === "true"}
                      onChange={(e) =>
                        setFieldValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.checked ? "true" : "",
                        }))
                      }
                      style={{ width: fontSize, height: fontSize, accentColor: "#2563eb" }}
                    />
                  </label>
                ) : (
                  <div
                    className="flex h-full w-full items-end"
                    style={{
                      borderBottom: isFilled ? "none" : "2px solid #93c5fd",
                      backgroundColor: isFilled ? "transparent" : "rgba(219,234,254,0.35)",
                      borderRadius: 2,
                    }}
                  >
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setFieldValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      placeholder={
                        fieldType === "name"
                          ? "Your name"
                          : fieldType === "date"
                            ? "Date"
                            : "Type here..."
                      }
                      className="w-full bg-transparent outline-none"
                      style={{
                        fontSize,
                        color: "#1a1a2e",
                        paddingLeft: 2,
                        paddingBottom: 1,
                        lineHeight: 1,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialFields, fieldValues]
  );

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md space-y-6 p-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Document Signed</h1>
            <p className="mt-2 text-muted-foreground">
              You have successfully signed &ldquo;{doc.title}&rdquo;. You can close this tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{doc.title}</h1>
            <p className="text-xs text-muted-foreground">
              Signing as {signer.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="shrink-0">
              {filledCount}/{initialFields.length} fields
            </Badge>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Finish Signing"
              )}
            </Button>
          </div>
        </div>
        {error && (
          <div className="border-t bg-red-50 px-4 py-2 text-center text-sm text-red-600 dark:bg-red-950/20">
            {error}
          </div>
        )}
      </div>

      {/* Message from sender */}
      {doc.message && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
            <p className="text-xs font-medium text-muted-foreground">
              Message from sender
            </p>
            <p className="mt-1 text-sm italic text-muted-foreground">
              &ldquo;{doc.message}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      <div className="flex-1 px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <PdfViewer
            src={pdfUrl}
            className="min-h-[600px]"
            renderPageOverlay={renderPageOverlay}
          />
        </div>
      </div>

      {/* Signature pad dialog */}
      <SignaturePad
        open={sigPadOpen}
        onOpenChange={setSigPadOpen}
        onConfirm={handleSignatureConfirm}
        signerName={signer.name}
      />
    </div>
  );
}
