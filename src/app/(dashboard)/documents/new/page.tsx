import { UploadDropzone } from "@/components/pdf/upload-dropzone";

export default function NewDocumentPage() {
  return (
    <div className="stagger-fade mx-auto max-w-2xl space-y-8 py-4">
      <div>
        <h2 className="font-serif text-3xl tracking-tight">New Document</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a PDF to get started. AI will analyze it and suggest fields.
        </p>
      </div>
      <UploadDropzone />
    </div>
  );
}
