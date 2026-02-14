"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadDropzone() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        setError("File size must be under 50MB");
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(10);

      try {
        const supabase = createBrowserClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        setProgress(20);

        // Upload to Supabase Storage
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, file, {
            contentType: "application/pdf",
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        setProgress(60);

        // Create document record
        const title = file.name.replace(/\.pdf$/i, "");
        const { data: doc, error: dbError } = await supabase
          .from("documents")
          .insert({
            owner_id: user.id,
            title,
            status: "draft",
            file_path: fileName,
          })
          .select("id")
          .single();

        if (dbError) throw dbError;

        setProgress(100);

        // Redirect to document detail page
        router.push(`/documents/${doc.id}`);
      } catch (err) {
        console.error("Upload failed:", err);
        setError(
          err instanceof Error ? err.message : "Upload failed. Please try again."
        );
        setUploading(false);
        setProgress(0);
      }
    },
    [router]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: { "application/pdf": [".pdf"] },
      maxFiles: 1,
      disabled: uploading,
    });

  const rejectionError =
    fileRejections.length > 0 ? "Please upload a PDF file" : null;
  const displayError = error || rejectionError;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-20 text-center transition-all duration-200 ${
          isDragActive
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-border/50 hover:border-accent/40 hover:bg-card/50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-5">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
            <div className="space-y-3">
              <p className="text-lg font-medium">Uploading document...</p>
              <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>
          </div>
        ) : isDragActive ? (
          <div className="space-y-4">
            <Upload className="mx-auto h-10 w-10 text-accent" />
            <p className="text-lg font-medium text-accent">
              Drop your PDF here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 transition-colors group-hover:bg-accent/15">
              <FileText className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to browse &middot; up to 50MB
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="mt-1"
            >
              Browse files
            </Button>
          </div>
        )}
      </div>
      {displayError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}
