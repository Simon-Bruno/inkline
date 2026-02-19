# Inkline

An e-signature platform built as a DocuSign alternative. Upload a PDF, let AI detect where fields should go, add signers, and send — recipients sign without creating an account.

## What it does

1. **Upload** — drag-and-drop a PDF (up to 50MB) into Supabase Storage
2. **Detect** — click "Smart Detect Fields": `pdf.js-extract` scans the PDF for underscore blank lines using exact text bounding boxes, then Gemini classifies each blank by its label and surrounding section heading (language-agnostic)
3. **Prepare** — drag fields onto the PDF canvas, assign them per-signer, choose parallel or sequential signing order
4. **Send** — one API call transitions the document to `pending`, generates signed storage URLs, and emails each signer a UUID access token link via Resend
5. **Sign** — signers open `/sign/:token` with no account required, fill fields, draw or type their signature, and submit
6. **Complete** — when all signers finish, the document auto-transitions to `completed`; every event is written to an append-only SHA-256 hash chain audit trail

## Technical highlights

### AI field detection

The detection pipeline is two-stage and does not rely on visual AI guessing coordinates:

1. **Positional extraction** (`src/lib/ai/pdf-field-detector.ts`): `pdf.js-extract` parses the PDF and returns raw text items with exact `(x, y, width, height)` in PDF points. The code scans for items containing `_{3,}` (underscore sequences) — either inline with a label or as standalone items — and converts their positions to percentage-based coordinates (0–100) for resolution independence.

2. **Classification** (`src/lib/ai/gemini.ts`): All detected blanks are batched into a single Gemini `gemini-2.0-flash` call with a minimal prompt: label text + nearest section heading → one word output per line (`signature`, `initials`, `date`, `name`, `text`, `checkbox`). Gemini is only used to understand intent, not to locate fields.

Section headings are detected programmatically (short lines ending with `:` starting with uppercase), so multi-language contracts work without additional configuration. Gemini fallback defaults every field to `text` if the API call fails.

### Audit trail hash chain

Every document lifecycle event (`created`, `sent`, `viewed`, `signed`, `completed`, `voided`) is written to the `audit_events` table (`src/lib/audit.ts`). Before insert, the previous event's `event_hash` is fetched. The new event's payload — including `previous_hash` — is SHA-256 hashed with Node's `crypto.createHash`. This creates a tamper-evident chain: modifying any historical event invalidates every subsequent hash.

```
payload = { document_id, event_type, signer_id, event_data, previous_hash, timestamp }
event_hash = SHA256(JSON.stringify(payload))
```

### No-account signing flow

Signers are identified by a UUID `access_token` stored in the `signers` table. The signing page (`src/app/sign/[token]/page.tsx`) creates a Supabase client that passes `x-signer-token` as a custom header — a Postgres RLS policy reads this header to scope access to just the signer's own data. PDF storage URLs are generated server-side with the service role key (signers have no auth session). The signer's `status` transitions: `pending` → `viewed` (on page load) → `signed` (on submit).

### PDF rendering

Client-side rendering via `pdfjs-dist` with a custom React wrapper (`src/components/pdf/pdf-viewer.tsx`). Each page renders to a canvas at `devicePixelRatio` resolution. A `renderPageOverlay` prop accepts a callback `(pageNumber, {width, height}) => ReactNode` — this is how interactive field overlays are composited over the PDF without touching the canvas. Zoom uses a `ResizeObserver` to recompute fit-width scale on container resize, and in-flight render tasks are cancelled before re-rendering.

### Signature pad

Draw mode (`src/components/signing/signature-pad.tsx`) uses the Pointer Events API (works with mouse, touch, and stylus). Stroke width varies with pointer speed — faster strokes produce thinner lines, mimicking real ink. In dark mode, a pixel-manipulation pass converts white ink to `#1a1a2e` before the data URL is stored. Type mode renders the name into an offscreen canvas using one of four Google script fonts (Dancing Script, Great Vibes, Caveat, Sacramento), auto-scaled to fit. The canvas is trimmed of transparent pixels before export.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Backend | Supabase — Postgres, Auth, Storage, Realtime, RLS |
| AI — field classification | Gemini 2.0 Flash (`@google/generative-ai`) |
| AI — OCR fallback | Google Document AI (`@google-cloud/documentai`) |
| PDF parsing | `pdf.js-extract` (server), `pdfjs-dist` (client) |
| Email | Resend |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI |
| Deployment | Vercel |
| Payments (planned) | Stripe |

## Database schema

Six tables, all with RLS enabled:

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` — name, company, plan, saved signature |
| `documents` | PDF metadata, status, `ai_fields` (JSONB), `ai_summary`, signing order, expiry |
| `signers` | Per-document signers with UUID `access_token`, status, IP, user agent, timestamps |
| `fields` | Signature/date/name/text/checkbox positions in percentage coordinates, per signer |
| `audit_events` | Append-only hash chain — `previous_hash` + `event_hash` (SHA-256) |
| `templates` | Document templates (schema ready, not yet wired up) |

## Project structure

```
src/
  app/
    (auth)/login/               Magic link + Google OAuth
    (dashboard)/dashboard/      Document list with status badges
    (dashboard)/documents/new/  PDF upload flow
    (dashboard)/documents/[id]/ Document preparation editor
    sign/[token]/               Public signing page (no auth required)
    api/
      process-document/         POST — AI field detection + Gemini summary
      send-for-signature/       POST — status transition + Resend emails + audit event
      sign/                     POST — field values, signer status, audit event, completion check
  components/
    pdf/                        PDF viewer, field overlay, draggable fields, signer panel
    signing/                    Signature pad (draw + type modes)
  lib/
    ai/                         pdf-field-detector, gemini, document-ai, use-ai-processing hook
    audit.ts                    SHA-256 hash chain
    supabase/                   Browser + server clients, middleware
  types/
    database.ts                 Generated Supabase types
    index.ts                    Domain types (DocumentStatus, FieldType, SigningOrder, etc.)
```

## Setup

### Prerequisites

- Node.js 20+
- Supabase project
- Google Cloud project with Document AI processor (Form Parser)
- Google AI Studio API key (Gemini)
- Resend account

### Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=

GEMINI_API_KEY=

RESEND_API_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — for Stripe billing (not yet active)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Run locally

```bash
npm install
npm run dev
```

### Supabase setup

Apply the initial migration from `supabase/migrations/` to create the 6 tables, RLS policies, indexes, and the profile auto-creation trigger. Enable the `documents` storage bucket with appropriate RLS (owners can upload; signers access via signed URL generated server-side).

The RLS policy for the signing flow reads the `x-signer-token` header:

```sql
-- signers can read their own row
CREATE POLICY "signer_token_access" ON signers
  FOR SELECT USING (access_token = current_setting('request.headers')::jsonb->>'x-signer-token');
```

## Auth

- **Senders** authenticate via Supabase Auth (magic link or Google OAuth). All dashboard routes are protected by middleware that refreshes the session.
- **Signers** are identified by a UUID access token in the URL — no account, no session. Expiry is enforced at both the page render and API handler level.
