"use client";

import { useCallback } from "react";
import { PdfViewer } from "@/components/pdf/pdf-viewer-dynamic";
import type { PageDimensions } from "@/components/pdf/pdf-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check,
  Clock,
  Eye,
  ArrowLeft,
  PenTool,
  Calendar,
  User,
  Hash,
  Type,
  CheckSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  pending: "outline",
  completed: "default",
  voided: "destructive",
  expired: "destructive",
};

const signerStatusConfig: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  pending: {
    icon: Clock,
    label: "Awaiting",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  viewed: {
    icon: Eye,
    label: "Viewed",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  signed: {
    icon: Check,
    label: "Signed",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  declined: {
    icon: Clock,
    label: "Declined",
    color: "text-red-600 bg-red-50 border-red-200",
  },
};

interface SignerInfo {
  id: string;
  name: string;
  email: string;
  status: string;
  signedAt: string | null;
  viewedAt: string | null;
}

interface FieldInfo {
  id: string;
  type: string;
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
}

const FIELD_ICONS: Record<string, React.ElementType> = {
  signature: PenTool,
  initials: Hash,
  date: Calendar,
  name: User,
  text: Type,
  checkbox: CheckSquare,
};

interface DocumentStatusViewProps {
  document: DocumentRow;
  pdfUrl: string;
  signers: SignerInfo[];
  fields: FieldInfo[];
}

export function DocumentStatusView({
  document: doc,
  pdfUrl,
  signers,
  fields,
}: DocumentStatusViewProps) {
  const router = useRouter();

  const signedCount = signers.filter((s) => s.status === "signed").length;

  const renderPageOverlay = useCallback(
    (pageNumber: number, dimensions: PageDimensions) => {
      const pageFields = fields.filter((f) => f.page === pageNumber);
      if (pageFields.length === 0) return null;

      return (
        <div className="relative h-full w-full">
          {pageFields.map((field) => {
            const pxLeft = (field.x / 100) * dimensions.width;
            const pxTop = (field.y / 100) * dimensions.height;
            const pxWidth = (field.width / 100) * dimensions.width;
            const pxHeight = (field.height / 100) * dimensions.height;
            const value = field.value || "";
            const hasSigned =
              signers.find((s) => s.id === field.signerId)?.status === "signed";
            const fontSize = Math.max(11, Math.min(pxHeight * 0.55, 16));

            return (
              <div
                key={field.id}
                className="absolute flex items-center"
                style={{
                  left: pxLeft,
                  top: pxTop,
                  width: pxWidth,
                  height: pxHeight,
                  zIndex: 10,
                }}
              >
                {(field.type === "signature" || field.type === "initials") &&
                value ? (
                  <div className="h-full w-full">
                    <img
                      src={value}
                      alt={field.type}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : field.type === "checkbox" ? (
                  <div className="flex h-full w-full items-center justify-center">
                    {value === "true" && (
                      <Check
                        style={{ width: fontSize + 2, height: fontSize + 2, color: "#1a1a2e" }}
                      />
                    )}
                  </div>
                ) : value ? (
                  <span
                    className="truncate"
                    style={{
                      fontSize,
                      color: "#1a1a2e",
                      paddingLeft: 2,
                    }}
                  >
                    {value}
                  </span>
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      border: "1.5px dashed",
                      borderColor: hasSigned ? "#d4d4d8" : "#fbbf24",
                      borderRadius: 3,
                      backgroundColor: hasSigned ? "rgba(244,244,245,0.5)" : "rgba(254,243,199,0.4)",
                    }}
                  >
                    <span style={{ fontSize: fontSize * 0.75, color: hasSigned ? "#a1a1aa" : "#d97706" }}>
                      {hasSigned ? "Empty" : "Pending"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    },
    [fields, signers]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">{doc.title}</h2>
          <Badge variant={statusVariant[doc.status] ?? "secondary"}>
            {doc.status}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {signedCount}/{signers.length} signed
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden">
          <PdfViewer
            src={pdfUrl}
            className="h-full"
            renderPageOverlay={renderPageOverlay}
          />
        </div>

        {/* Right Sidebar — Signer Status */}
        <div className="w-80 shrink-0 overflow-y-auto border-l bg-background p-4">
          <div className="space-y-5">
            {/* Progress */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Signing Progress
              </h3>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      signers.length > 0
                        ? (signedCount / signers.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {signedCount} of {signers.length} signer
                {signers.length !== 1 ? "s" : ""} completed
              </p>
            </div>

            {/* Signer list */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Signers
              </h3>
              <div className="space-y-2">
                {signers.map((signer) => {
                  const config =
                    signerStatusConfig[signer.status] ??
                    signerStatusConfig.pending;
                  const StatusIcon = config.icon;
                  const signerFields = fields.filter(
                    (f) => f.signerId === signer.id
                  );
                  const filledFields = signerFields.filter((f) => {
                    if (f.type === "checkbox") return f.value === "true";
                    return f.value && f.value.trim().length > 0;
                  });

                  return (
                    <div
                      key={signer.id}
                      className={`rounded-lg border p-3 ${config.color}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {signer.name}
                          </p>
                          <p className="truncate text-xs opacity-70">
                            {signer.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </div>
                      </div>
                      {/* Field fill progress */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
                          <div
                            className="h-full rounded-full bg-current transition-all"
                            style={{
                              width: `${
                                signerFields.length > 0
                                  ? (filledFields.length /
                                      signerFields.length) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-medium">
                          {filledFields.length}/{signerFields.length} fields
                        </span>
                      </div>
                      {/* Timestamps */}
                      {signer.signedAt && (
                        <p className="mt-1.5 text-[10px] opacity-60">
                          Signed{" "}
                          {new Date(signer.signedAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {!signer.signedAt && signer.viewedAt && (
                        <p className="mt-1.5 text-[10px] opacity-60">
                          Viewed{" "}
                          {new Date(signer.viewedAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document info */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Details
              </h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Created</span>
                  <span>
                    {new Date(doc.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {doc.expires_at && (
                  <div className="flex justify-between">
                    <span>Expires</span>
                    <span>
                      {new Date(doc.expires_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {doc.completed_at && (
                  <div className="flex justify-between">
                    <span>Completed</span>
                    <span>
                      {new Date(doc.completed_at).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Total fields</span>
                  <span>{fields.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
