# Inkline - AI-Native E-Signature Platform

> A DocuSign competitor with superior UX, AI-powered field detection, and modern design.

## Quick Reference

- **Architecture doc**: `/Users/simonbruno/docusign-killer/ARCHITECTURE.md` (full spec, decisions, schemas, flows)
- **Phase 2 spec**: `/Users/simonbruno/inkline/PHASE2.md` (current work)
- **Project dir**: `/Users/simonbruno/inkline/`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) |
| OCR | Google Document AI |
| AI | Gemini API |
| Email | Resend (free tier: 100/day, 3k/month) |
| PDF Viewing | PDF.js (client-side) |
| PDF Editing | pdf-lib (server-side) |
| Deployment | Vercel |
| Payments | Stripe |

## Project Structure

```
inkline/
  src/
    app/
      (auth)/login/              # Magic link + Google OAuth login
      (dashboard)/dashboard/     # Document list with status badges
      (dashboard)/dashboard/settings/  # Profile editing
      (dashboard)/documents/new/ # Upload + prepare flow (Phase 2)
      (dashboard)/documents/[id]/ # Document detail (Phase 2)
      sign/[token]/              # Public signing page (Phase 3)
      auth/callback/             # OAuth/magic link callback
    components/
      ui/                        # shadcn/ui (button, input, card, dialog, dropdown-menu, badge, avatar, command)
      dashboard/sidebar.tsx      # Sidebar nav component
      pdf/                       # PDF viewer + field overlay (Phase 2)
      signing/                   # Signature pad, field renderer (Phase 3)
    lib/
      supabase/client.ts         # Browser Supabase client
      supabase/server.ts         # Server Supabase client
      supabase/middleware.ts     # Auth session refresh
      ai/                        # AI utilities (Phase 2)
      pdf/                       # PDF manipulation helpers (Phase 2)
    types/
      database.ts                # Full Supabase Database type (Row, Insert, Update for all tables)
      index.ts                   # Domain types (DocumentStatus, SignerStatus, FieldType, etc.)
    proxy.ts                     # Route protection (auth session refresh)
  supabase/
    migrations/00001_initial_schema.sql  # 6 tables, indexes, RLS, triggers
    functions/                   # Edge Functions (Phase 2+)
  emails/                        # React Email templates (Phase 4)
```

## Database Tables

6 tables with RLS enabled on all:
- `profiles` - extends auth.users (name, email, company, plan, saved signature)
- `documents` - PDFs with status, AI summary, AI field suggestions
- `signers` - per-document signer records with unique access_tokens
- `fields` - signature/date/name fields positioned on PDF pages (percentage-based 0-100)
- `audit_events` - append-only, SHA-256 hash chain for tamper evidence
- `templates` - V2, schema ready

## Auth

- **Users (senders)**: Magic link + Google OAuth via Supabase Auth
- **Signers**: UUID access_token in URL, no account required
- Middleware protects all routes except: `/login`, `/sign/*`, `/auth/callback`, `/api/*`
- Profile auto-created on first login via database trigger

## Key Patterns

- **Supabase clients**: Use `createBrowserClient()` from `lib/supabase/client.ts` in client components, `createServerClient()` from `lib/supabase/server.ts` in server components/route handlers
- **Status badges**: Draft=gray, Pending=amber, Completed=emerald, Voided=red, Expired=red
- **Field positioning**: Percentage-based (0-100) for resolution independence
- **Audit trail**: Every event hashes the previous event (SHA-256 chain)
- **AI processing**: Async via Edge Functions, results pushed via Supabase Realtime

## Development Phases

- **Phase 1**: Foundation - COMPLETE
- **Phase 2**: Core PDF Experience + AI (see PHASE2.md)
- **Phase 3**: Signing Flow (signature pad, public signing page, guided UX, PDF flattening)
- **Phase 4**: Email + Completion (Resend emails, real-time updates, audit trail, reminders)
- **Phase 5**: Polish + Launch (mobile optimization, Stripe billing, landing page)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_LOCATION=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GEMINI_API_KEY=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

## Conventions

- Use shadcn/ui components for all UI
- Server components by default, client components only when needed (interactivity, hooks)
- TypeScript strict mode
- Tailwind for styling, no CSS modules
- Linear/Notion-inspired minimal aesthetic
- Dark mode supported via next-themes
