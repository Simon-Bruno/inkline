import { createServerClient } from "@/lib/supabase/server";
import { createAuditEvent } from "@/lib/audit";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type SignerRow = Database["public"]["Tables"]["signers"]["Row"];
type FieldRow = Database["public"]["Tables"]["fields"]["Row"];

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  try {
    const { documentId, message } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch document (RLS ensures ownership)
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    const doc = docData as DocumentRow | null;
    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (doc.status !== "draft") {
      return NextResponse.json(
        { error: "Document has already been sent" },
        { status: 400 }
      );
    }

    // Fetch signers
    const { data: signersData, error: signersError } = await supabase
      .from("signers")
      .select("*")
      .eq("document_id", documentId)
      .order("order_index");

    const signers = signersData as SignerRow[] | null;
    if (signersError || !signers || signers.length === 0) {
      return NextResponse.json(
        { error: "Document must have at least one signer" },
        { status: 400 }
      );
    }

    // Fetch fields
    const { data: fieldsData, error: fieldsError } = await supabase
      .from("fields")
      .select("*")
      .eq("document_id", documentId);

    const fields = fieldsData as FieldRow[] | null;
    if (fieldsError || !fields || fields.length === 0) {
      return NextResponse.json(
        { error: "Document must have at least one field" },
        { status: 400 }
      );
    }

    // Verify every signer has at least one field
    const signerIds = new Set(signers.map((s: SignerRow) => s.id));
    const signersWithFields = new Set(fields.map((f: FieldRow) => f.signer_id));
    for (const signerId of signerIds) {
      if (!signersWithFields.has(signerId)) {
        const signer = signers.find((s: SignerRow) => s.id === signerId);
        return NextResponse.json(
          {
            error: `Signer "${signer?.name}" has no fields assigned`,
          },
          { status: 400 }
        );
      }
    }

    // Update document status to pending with 30-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "pending",
        expires_at: expiresAt.toISOString(),
        message_to_signers: message || null,
      })
      .eq("id", documentId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update document status" },
        { status: 500 }
      );
    }

    // Get sender profile for email
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const senderName = profile?.full_name || user.email || "Someone";

    // Create audit event
    await createAuditEvent({
      supabase,
      documentId,
      eventType: "sent",
      actorId: user.id,
      eventData: {
        signerCount: signers.length,
        fieldCount: fields.length,
      },
    });

    // Send emails to each signer
    const emailPromises = signers.map((signer) => {
      const signingUrl = `${APP_URL}/sign/${signer.access_token}`;

      return resend.emails.send({
        from: "Inkline <onboarding@resend.dev>",
        to: signer.email,
        subject: `${senderName} has requested your signature on "${doc.title}"`,
        html: buildSigningEmail({
          signerName: signer.name,
          senderName,
          documentTitle: doc.title,
          message: message || null,
          signingUrl,
        }),
      });
    });

    const emailResults = await Promise.allSettled(emailPromises);
    const failures = emailResults.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        "Some emails failed to send:",
        failures.map((f) => (f as PromiseRejectedResult).reason)
      );
    }

    return NextResponse.json({
      success: true,
      emailsSent: emailResults.filter((r) => r.status === "fulfilled").length,
      emailsFailed: failures.length,
    });
  } catch (error) {
    console.error("Error sending for signature:", error);
    return NextResponse.json(
      { error: "Failed to send for signature" },
      { status: 500 }
    );
  }
}

function buildSigningEmail(params: {
  signerName: string;
  senderName: string;
  documentTitle: string;
  message: string | null;
  signingUrl: string;
}) {
  const { signerName, senderName, documentTitle, message, signingUrl } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">Inkline</div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:15px;line-height:1.6;">
                Hi ${signerName},
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
                <strong>${senderName}</strong> has requested your signature on <strong>"${documentTitle}"</strong>.
              </p>
              ${
                message
                  ? `<div style="margin:0 0 24px;padding:12px 16px;background:#f4f4f5;border-radius:8px;color:#52525b;font-size:14px;line-height:1.5;font-style:italic;">"${message}"</div>`
                  : ""
              }
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 16px;">
                    <a href="${signingUrl}" style="display:inline-block;padding:12px 32px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                      Review & Sign
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;text-align:center;">
                This link expires in 30 days. If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f4f4f5;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Sent via Inkline &mdash; Simple, secure e-signatures
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
