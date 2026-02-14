import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, FileText, ArrowRight, PenLine } from "lucide-react";
import type { Database } from "@/types/database";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Signer = Database["public"]["Tables"]["signers"]["Row"];

type DocumentWithSigners = Document & {
  signers: Pick<Signer, "id" | "name" | "email" | "status">[];
};

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "border-transparent bg-muted text-muted-foreground",
  },
  pending: {
    label: "Pending",
    className:
      "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  voided: {
    label: "Voided",
    className:
      "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
  },
  expired: {
    label: "Expired",
    className:
      "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("documents")
    .select("*, signers(id, name, email, status)")
    .order("created_at", { ascending: false });

  const documents = (data as unknown as DocumentWithSigners[] | null) ?? [];

  return (
    <div className="stagger-fade space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your documents and track signatures
          </p>
        </div>
        <Link href="/documents/new">
          <Button className="gap-2 font-medium">
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <PenLine className="h-7 w-7 text-accent" />
          </div>
          <h3 className="mt-6 font-serif text-2xl">No documents yet</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Send your first document for signature. Upload a PDF and let AI
            detect where signatures should go.
          </p>
          <Link href="/documents/new" className="mt-8">
            <Button className="gap-2 font-medium">
              <Plus className="h-4 w-4" />
              Upload your first PDF
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_120px_100px_40px] gap-4 border-b border-border/50 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Title</span>
            <span>Status</span>
            <span>Signers</span>
            <span>Created</span>
            <span />
          </div>

          {/* Document rows */}
          {documents.map((doc) => {
            const status = statusConfig[doc.status] ?? statusConfig.draft;
            const signerCount = doc.signers?.length ?? 0;
            const signedCount =
              doc.signers?.filter((s) => s.status === "signed").length ?? 0;

            return (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="group grid grid-cols-[1fr_100px_120px_100px_40px] items-center gap-4 border-b border-border/30 px-5 py-3.5 text-sm transition-colors last:border-0 hover:bg-secondary/50"
              >
                <span className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground/50" />
                  <span className="truncate font-medium">{doc.title}</span>
                </span>
                <span>
                  <Badge
                    variant="ghost"
                    className={status.className}
                  >
                    {status.label}
                  </Badge>
                </span>
                <span className="text-muted-foreground">
                  {signerCount > 0
                    ? `${signedCount}/${signerCount} signed`
                    : "No signers"}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(doc.created_at)}
                </span>
                <span className="flex justify-end">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
