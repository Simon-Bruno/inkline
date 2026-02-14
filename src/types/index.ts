export type { Database } from "./database";

export type DocumentStatus =
  | "draft"
  | "pending"
  | "completed"
  | "voided"
  | "expired";

export type SignerStatus = "pending" | "viewed" | "signed" | "declined";

export type SignerRole = "signer" | "viewer" | "approver";

export type FieldType =
  | "signature"
  | "initials"
  | "date"
  | "name"
  | "text"
  | "checkbox";

export type SigningOrder = "parallel" | "sequential";

export type SignatureMethod = "draw" | "type" | "upload";

export type Plan = "free" | "pro" | "business";

export type AuditEventType =
  | "created"
  | "sent"
  | "viewed"
  | "signed"
  | "completed"
  | "voided"
  | "reminder_sent"
  | "downloaded"
  | "field_placed";
