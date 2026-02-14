import { createClient } from "@supabase/supabase-js";
import { createAuditEvent } from "@/lib/audit";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

type SignerRow = Database["public"]["Tables"]["signers"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

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

// Service client bypasses RLS — needed to check ALL signers, not just the current one
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface FieldValue {
  fieldId: string;
  value: string;
}

export async function POST(request: Request) {
  try {
    const { accessToken, fieldValues } = (await request.json()) as {
      accessToken: string;
      fieldValues: FieldValue[];
    };

    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken is required" },
        { status: 400 }
      );
    }
    if (!fieldValues || !Array.isArray(fieldValues)) {
      return NextResponse.json(
        { error: "fieldValues array is required" },
        { status: 400 }
      );
    }

    const supabase = createSignerClient(accessToken);

    // Look up signer by access token
    const { data: signerData, error: signerError } = await supabase
      .from("signers")
      .select("*")
      .eq("access_token", accessToken)
      .single();

    const signer = signerData as SignerRow | null;
    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Invalid or expired signing link" },
        { status: 404 }
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
      return NextResponse.json(
        { error: "This document is no longer available for signing" },
        { status: 400 }
      );
    }

    // Check expiry
    if (document.expires_at && new Date(document.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This signing link has expired" },
        { status: 400 }
      );
    }

    if (signer.status === "signed") {
      return NextResponse.json(
        { error: "You have already signed this document" },
        { status: 400 }
      );
    }

    // Update field values
    for (const fv of fieldValues) {
      const { error: updateError } = await supabase
        .from("fields")
        .update({ value: fv.value })
        .eq("id", fv.fieldId)
        .eq("signer_id", signer.id);

      if (updateError) {
        console.error("Failed to update field:", fv.fieldId, updateError);
      }
    }

    // Mark signer as signed
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = request.headers.get("user-agent") || null;

    await supabase
      .from("signers")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: ua,
      })
      .eq("id", signer.id);

    // Create audit event
    await createAuditEvent({
      supabase,
      documentId: document.id,
      eventType: "signed",
      signerId: signer.id,
      eventData: {
        signerEmail: signer.email,
        signerName: signer.name,
        fieldCount: fieldValues.length,
      },
      ipAddress: ip,
      userAgent: ua,
    });

    // Check if all signers have signed (use service client to see ALL signers)
    const serviceClient = createServiceClient();
    const { data: allSignersData } = await serviceClient
      .from("signers")
      .select("status")
      .eq("document_id", document.id);

    const allSigners = allSignersData as Pick<SignerRow, "status">[] | null;
    const allSigned = allSigners?.every((s) => s.status === "signed") ?? false;

    if (allSigned) {
      await serviceClient
        .from("documents")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", document.id);

      await createAuditEvent({
        supabase: serviceClient,
        documentId: document.id,
        eventType: "completed",
        eventData: {
          totalSigners: allSigners?.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      documentCompleted: allSigned,
    });
  } catch (error) {
    console.error("Error processing signature:", error);
    return NextResponse.json(
      { error: "Failed to process signature" },
      { status: 500 }
    );
  }
}
