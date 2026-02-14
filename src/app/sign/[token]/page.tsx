import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SigningView } from "./signing-view";

type SignerRow = Database["public"]["Tables"]["signers"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type FieldRow = Database["public"]["Tables"]["fields"]["Row"];

function createSignerClient(signerToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          "x-signer-token": signerToken,
        },
      },
    }
  );
}

// Service role client for storage operations (signers have no auth session)
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function SigningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createSignerClient(token);

  // Look up signer by access_token
  const { data: signerData, error: signerError } = await supabase
    .from("signers")
    .select("*")
    .eq("access_token", token)
    .single();

  const signer = signerData as SignerRow | null;
  if (signerError || !signer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Link Not Found</h1>
          <p className="text-muted-foreground">
            This signing link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  // Fetch document
  const { data: docData } = await supabase
    .from("documents")
    .select("*")
    .eq("id", signer.document_id)
    .single();

  const document = docData as DocumentRow | null;
  if (!document || document.status !== "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Document Unavailable</h1>
          <p className="text-muted-foreground">
            {document?.status === "completed"
              ? "This document has already been completed."
              : "This document is no longer available for signing."}
          </p>
        </div>
      </div>
    );
  }

  // Check expiry
  if (document.expires_at && new Date(document.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Link Expired</h1>
          <p className="text-muted-foreground">
            This signing link has expired. Please contact the sender for a new one.
          </p>
        </div>
      </div>
    );
  }

  // Already signed
  if (signer.status === "signed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Already Signed</h1>
          <p className="text-muted-foreground">
            You have already signed this document. Thank you!
          </p>
        </div>
      </div>
    );
  }

  // Fetch fields for this signer
  const { data: fieldsData } = await supabase
    .from("fields")
    .select("*")
    .eq("document_id", document.id)
    .eq("signer_id", signer.id)
    .order("page", { ascending: true });

  const fields = (fieldsData ?? []) as FieldRow[];

  // Get PDF URL (use service client — signers have no auth session for storage)
  const serviceClient = createServiceClient();
  const { data: pdfData } = await serviceClient.storage
    .from("documents")
    .createSignedUrl(document.file_path, 3600); // 1 hour

  if (!pdfData?.signedUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="text-muted-foreground">
            Failed to load the document. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  // Mark signer as "viewed" if currently "pending"
  if (signer.status === "pending") {
    await supabase
      .from("signers")
      .update({
        status: "viewed",
        viewed_at: new Date().toISOString(),
      })
      .eq("id", signer.id);
  }

  return (
    <SigningView
      accessToken={token}
      signer={{
        id: signer.id,
        name: signer.name,
        email: signer.email,
      }}
      document={{
        id: document.id,
        title: document.title,
        message: document.message_to_signers,
      }}
      fields={fields.map((f) => ({
        id: f.id,
        type: typeof f.type === "string" ? f.type.toLowerCase().trim() : "text",
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        isRequired: f.is_required,
        value: f.value,
      }))}
      pdfUrl={pdfData.signedUrl}
    />
  );
}
