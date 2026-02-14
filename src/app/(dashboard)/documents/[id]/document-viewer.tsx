"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PdfViewer } from "@/components/pdf/pdf-viewer-dynamic";
import { FieldOverlay } from "@/components/pdf/field-overlay";
import { FieldToolbar } from "@/components/pdf/field-toolbar";
import { SignerPanel, type SignerData } from "@/components/pdf/signer-panel";
import type { FieldData } from "@/components/pdf/draggable-field";
import type { PageDimensions } from "@/components/pdf/pdf-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Send, Save, Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import type { FieldType, SigningOrder } from "@/types";
import { useAIProcessing } from "@/lib/ai/use-ai-processing";
import type { AISuggestedField } from "@/lib/ai/types";

type Document = Database["public"]["Tables"]["documents"]["Row"];

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending: "outline",
  completed: "default",
  voided: "destructive",
  expired: "destructive",
};

interface DocumentViewerProps {
  document: Document;
  pdfUrl: string;
  initialSigners: SignerData[];
  initialFields: FieldData[];
}

export function DocumentViewer({
  document: doc,
  pdfUrl,
  initialSigners,
  initialFields,
}: DocumentViewerProps) {
  const [fields, setFields] = useState<FieldData[]>(initialFields);
  const [signers, setSigners] = useState<SignerData[]>(initialSigners);
  const [activeFieldType, setActiveFieldType] = useState<FieldType | null>(null);
  const [activeSignerId, setActiveSignerId] = useState<string | null>(
    initialSigners[0]?.id ?? null
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [signingOrder, setSigningOrder] = useState<SigningOrder>(
    (doc.signing_order as SigningOrder) ?? "parallel"
  );
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useRef(createBrowserClient());
  const router = useRouter();

  // AI processing
  const {
    fields: aiFields,
    summary: aiSummary,
    isProcessing: aiProcessing,
    error: aiError,
    triggerProcessing,
  } = useAIProcessing({ documentId: doc.id });

  // Load AI suggestions as fields when they arrive
  const aiApplied = useRef(false);
  useEffect(() => {
    if (!aiFields || aiFields.length === 0 || aiApplied.current) return;
    if (signers.length === 0) return; // need at least one signer
    aiApplied.current = true;

    // Build a mapping of roles to signers
    // Try to match AI-detected roles (e.g., "CLIENT", "CONTRACTOR") to signer names
    function matchSignerByRole(role?: string): string {
      if (!role || signers.length === 0) return signers[0].id;
      if (signers.length === 1) return signers[0].id;

      const roleLower = role.toLowerCase();

      // Direct name match: if a signer's name contains the role
      for (const s of signers) {
        if (s.name.toLowerCase().includes(roleLower)) return s.id;
      }

      // Collect unique roles from all AI fields
      const allRoles = [...new Set(aiFields!.map((f) => f.role).filter(Boolean))] as string[];

      // Assign roles to signers in order they appear
      const roleIndex = allRoles.indexOf(role);
      if (roleIndex >= 0 && roleIndex < signers.length) {
        return signers[roleIndex].id;
      }

      return signers[0].id;
    }

    const suggestedFields: FieldData[] = aiFields.map((af: AISuggestedField) => ({
      id: crypto.randomUUID(),
      type: af.type,
      page: af.page,
      x: af.x,
      y: af.y,
      width: af.width,
      height: af.height,
      signerId: matchSignerByRole(af.role),
      isRequired: true,
      aiSuggested: true,
    }));

    setFields((prev) => [...prev, ...suggestedFields]);
  }, [aiFields, signers]);

  // Build signer index map for coloring
  const signerIndexMap = new Map(signers.map((s, i) => [s.id, i]));

  // Auto-save debounced
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveAll(), 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fields !== initialFields || signers !== initialSigners) {
      scheduleSave();
    }
  }, [fields, signers, signingOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAll() {
    setSaving(true);
    const sb = supabase.current;

    // Update signing order on document
    await sb
      .from("documents")
      .update({ signing_order: signingOrder })
      .eq("id", doc.id);

    // Upsert signers
    for (const signer of signers) {
      await sb.from("signers").upsert(
        {
          id: signer.id,
          document_id: doc.id,
          name: signer.name,
          email: signer.email,
          order_index: signer.orderIndex,
        },
        { onConflict: "id" }
      );
    }

    // Delete removed fields, then upsert current ones
    const currentFieldIds = fields.map((f) => f.id);
    if (currentFieldIds.length > 0) {
      await sb
        .from("fields")
        .delete()
        .eq("document_id", doc.id)
        .not("id", "in", `(${currentFieldIds.join(",")})`);
    } else {
      await sb.from("fields").delete().eq("document_id", doc.id);
    }

    for (const field of fields) {
      await sb.from("fields").upsert(
        {
          id: field.id,
          document_id: doc.id,
          signer_id: field.signerId,
          type: field.type,
          page: field.page,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          is_required: field.isRequired,
          ai_suggested: field.aiSuggested,
        },
        { onConflict: "id" }
      );
    }

    setSaving(false);
    setLastSaved(new Date());
  }

  async function handleSendForSignature() {
    setSending(true);
    setSendError(null);

    // Save first to ensure everything is persisted
    await saveAll();

    try {
      const res = await fetch("/api/send-for-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          message: sendMessage || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || "Failed to send");
        setSending(false);
        return;
      }

      setSendDialogOpen(false);
      router.push("/dashboard");
    } catch {
      setSendError("Network error. Please try again.");
      setSending(false);
    }
  }

  // Signer management
  const addSigner = useCallback(
    (name: string, email: string) => {
      const newSigner: SignerData = {
        id: crypto.randomUUID(),
        name,
        email,
        orderIndex: signers.length,
      };
      setSigners((prev) => [...prev, newSigner]);
      setActiveSignerId(newSigner.id);
    },
    [signers.length]
  );

  const removeSigner = useCallback(
    (id: string) => {
      setSigners((prev) => prev.filter((s) => s.id !== id));
      setFields((prev) => prev.filter((f) => f.signerId !== id));
      if (activeSignerId === id) {
        setActiveSignerId(signers.find((s) => s.id !== id)?.id ?? null);
      }
      // Also delete from DB
      supabase.current.from("signers").delete().eq("id", id).then(() => {});
    },
    [activeSignerId, signers]
  );

  // Field management
  const placeField = useCallback((field: Omit<FieldData, "id">) => {
    const newField: FieldData = { ...field, id: crypto.randomUUID() };
    setFields((prev) => [...prev, newField]);
  }, []);

  const moveField = useCallback((id: string, x: number, y: number) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, x, y } : f))
    );
  }, []);

  const deleteField = useCallback(
    (id: string) => {
      setFields((prev) => prev.filter((f) => f.id !== id));
      if (selectedFieldId === id) setSelectedFieldId(null);
      supabase.current.from("fields").delete().eq("id", id).then(() => {});
    },
    [selectedFieldId]
  );

  const renderPageOverlay = useCallback(
    (pageNumber: number, dimensions: PageDimensions) => (
      <FieldOverlay
        pageNumber={pageNumber}
        pageWidth={dimensions.width}
        pageHeight={dimensions.height}
        fields={fields}
        selectedFieldId={selectedFieldId}
        activeFieldType={activeFieldType}
        activeSignerId={activeSignerId}
        signerIndexMap={signerIndexMap}
        onFieldSelect={setSelectedFieldId}
        onFieldMove={moveField}
        onFieldDelete={deleteField}
        onFieldPlace={placeField}
        onDeselect={() => setSelectedFieldId(null)}
      />
    ),
    [
      fields,
      selectedFieldId,
      activeFieldType,
      activeSignerId,
      signerIndexMap,
      moveField,
      deleteField,
      placeField,
    ]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{doc.title}</h2>
          <Badge variant={statusVariant[doc.status] ?? "secondary"}>
            {doc.status}
          </Badge>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          {!saving && lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => saveAll()}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            size="sm"
            disabled={signers.length === 0 || fields.length === 0}
            onClick={() => setSendDialogOpen(true)}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send for Signature
          </Button>
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

        {/* Right Sidebar */}
        <div className="w-72 shrink-0 overflow-y-auto border-l bg-background p-4">
          <div className="space-y-6">
            <SignerPanel
              signers={signers}
              activeSignerId={activeSignerId}
              signingOrder={signingOrder}
              onAddSigner={addSigner}
              onRemoveSigner={removeSigner}
              onSelectSigner={setActiveSignerId}
              onSigningOrderChange={setSigningOrder}
            />
            {/* AI Smart Detect */}
            <div className="border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Detect
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => {
                  aiApplied.current = false;
                  triggerProcessing();
                }}
                disabled={aiProcessing || signers.length === 0}
              >
                {aiProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing document...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Smart Detect Fields
                  </>
                )}
              </Button>
              {signers.length === 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Add a signer first to use AI detection.
                </p>
              )}
              {aiError && (
                <p className="mt-1.5 text-xs text-red-500">{aiError}</p>
              )}
              {aiSummary && (
                <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      AI Summary
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {aiSummary.bullets.map((bullet, i) => (
                      <li
                        key={i}
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        &bull; {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <FieldToolbar
                activeType={activeFieldType}
                onSelect={setActiveFieldType}
                disabled={!activeSignerId}
              />
            </div>
            {!activeSignerId && signers.length > 0 && (
              <p className="text-xs text-amber-600">
                Select a signer to start placing fields.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Send for Signature Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
            <DialogDescription>
              This will email {signers.length} signer{signers.length !== 1 ? "s" : ""} a link to review and sign &ldquo;{doc.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Signers
              </label>
              <div className="space-y-1">
                {signers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span>&lt;{s.email}&gt;</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="send-message" className="mb-1.5 block text-sm font-medium">
                Message to signers <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="send-message"
                placeholder="Please review and sign this document..."
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
              />
            </div>
            {sendError && (
              <p className="text-sm text-red-500">{sendError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={handleSendForSignature} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
