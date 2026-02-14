import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DocumentViewer } from "./document-viewer";
import { DocumentStatusView } from "./document-status-view";
import type { Database } from "@/types/database";
import type { SignerData } from "@/components/pdf/signer-panel";
import type { FieldData } from "@/components/pdf/draggable-field";
import type { FieldType } from "@/types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type SignerRow = Database["public"]["Tables"]["signers"]["Row"];
type FieldRow = Database["public"]["Tables"]["fields"]["Row"];

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  const document = data as DocumentRow | null;
  if (!document) notFound();

  // Generate a signed URL for the PDF (valid 1 hour)
  const { data: signedUrl } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.file_path, 3600);

  if (!signedUrl?.signedUrl) {
    return (
      <div className="flex items-center justify-center p-16 text-destructive">
        Could not load document file
      </div>
    );
  }

  // Fetch existing signers
  const { data: signerRows } = await supabase
    .from("signers")
    .select("*")
    .eq("document_id", id)
    .order("order_index");

  const signers = (signerRows ?? []) as SignerRow[];

  // Fetch existing fields
  const { data: fieldRows } = await supabase
    .from("fields")
    .select("*")
    .eq("document_id", id);

  const fields = (fieldRows ?? []) as FieldRow[];

  // If document is draft, show the editor
  if (document.status === "draft") {
    const initialSigners: SignerData[] = signers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      orderIndex: s.order_index,
    }));

    const initialFields: FieldData[] = fields.map((f) => ({
      id: f.id,
      type: f.type as FieldType,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      signerId: f.signer_id,
      isRequired: f.is_required,
      aiSuggested: f.ai_suggested,
    }));

    return (
      <DocumentViewer
        document={document}
        pdfUrl={signedUrl.signedUrl}
        initialSigners={initialSigners}
        initialFields={initialFields}
      />
    );
  }

  // For pending/completed/voided/expired, show status view
  return (
    <DocumentStatusView
      document={document}
      pdfUrl={signedUrl.signedUrl}
      signers={signers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        status: s.status,
        signedAt: s.signed_at,
        viewedAt: s.viewed_at,
      }))}
      fields={fields.map((f) => ({
        id: f.id,
        type: f.type,
        signerId: f.signer_id,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value,
      }))}
    />
  );
}
