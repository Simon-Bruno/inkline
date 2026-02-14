// POST /api/process-document
// Processes a document with AI: field detection + contract summary
// Field detection uses actual PDF text positions (programmatic, precise).
// Summary uses Gemini AI.

import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { detectFieldsFromPDF } from "@/lib/ai/pdf-field-detector";
import { summarizeContract } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch the document record (RLS ensures user owns it)
    type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    const document = docData as DocumentRow | null;
    if (docError || !document) {
      console.error("Document fetch error:", docError);
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // 2. Download PDF from Supabase Storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from("documents")
      .download(document.file_path);

    if (fileError || !fileData) {
      console.error("Storage download error:", fileError);
      return NextResponse.json(
        { error: "Failed to download PDF from storage" },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

    // 3. Extract text positions and detect fields programmatically
    const { fields, fullText, pageCount, debug } = await detectFieldsFromPDF(pdfBuffer);

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: "No text could be extracted from the document" },
        { status: 422 }
      );
    }

    // 4. Get AI summary (Gemini) in parallel - don't block on it
    let summary = { bullets: [] as string[] };
    try {
      summary = await summarizeContract(fullText);
    } catch (err) {
      console.warn("Gemini summary failed, continuing without:", err);
    }

    // 5. Update the document with results
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        ai_fields: fields as unknown as Database["public"]["Tables"]["documents"]["Update"]["ai_fields"],
        ai_summary: JSON.stringify(summary),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document with AI results:", updateError);
      return NextResponse.json(
        { error: "Failed to save AI results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fields,
      summary,
      pageCount,
      debug: debug ?? undefined,
    });
  } catch (error) {
    console.error("Error processing document:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `AI processing failed: ${message}` },
      { status: 500 }
    );
  }
}
