"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading viewer...</p>
    </div>
  ),
});

export { PdfViewer };
