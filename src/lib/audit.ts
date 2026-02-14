import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AuditEventType } from "@/types";

interface CreateAuditEventParams {
  supabase: SupabaseClient<Database>;
  documentId: string;
  eventType: AuditEventType;
  signerId?: string | null;
  actorId?: string | null;
  eventData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAuditEvent({
  supabase,
  documentId,
  eventType,
  signerId = null,
  actorId = null,
  eventData = null,
  ipAddress = null,
  userAgent = null,
}: CreateAuditEventParams) {
  // Fetch the last audit event for this document to get its hash
  const { data: lastEvent } = await supabase
    .from("audit_events")
    .select("event_hash")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const previousHash = lastEvent?.event_hash ?? null;

  // Build the payload to hash
  const payload = JSON.stringify({
    document_id: documentId,
    event_type: eventType,
    signer_id: signerId,
    actor_id: actorId,
    event_data: eventData,
    previous_hash: previousHash,
    timestamp: new Date().toISOString(),
  });

  const eventHash = createHash("sha256").update(payload).digest("hex");

  const { error } = await supabase.from("audit_events").insert({
    document_id: documentId,
    event_type: eventType,
    signer_id: signerId,
    actor_id: actorId,
    event_data: eventData as Database["public"]["Tables"]["audit_events"]["Insert"]["event_data"],
    ip_address: ipAddress,
    user_agent: userAgent,
    previous_hash: previousHash,
    event_hash: eventHash,
  });

  if (error) {
    console.error("Failed to create audit event:", error);
  }

  return { eventHash, error };
}
