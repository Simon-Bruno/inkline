# Phase 2: Core PDF Experience + AI

> Upload a PDF, view it, place fields on it, and have AI auto-detect where fields should go.

## Prerequisites

Phase 1 is complete. The following exists:
- Next.js app at `/Users/simonbruno/inkline/` with auth, dashboard, sidebar
- Database schema with `documents`, `fields`, `signers` tables
- Supabase client helpers in `src/lib/supabase/`
- TypeScript types in `src/types/database.ts` and `src/types/index.ts`
- Route stubs at `(dashboard)/documents/new/` and `(dashboard)/documents/[id]/`

## What Phase 2 Builds

### Task A: PDF Upload + Viewer

**Files to create/modify:**
- `src/app/(dashboard)/documents/new/page.tsx` - Upload flow
- `src/components/pdf/pdf-viewer.tsx` - PDF.js viewer component
- `src/components/pdf/upload-dropzone.tsx` - Drag-and-drop upload area
- `src/lib/pdf/viewer.ts` - PDF.js initialization helpers

**Requirements:**
1. Drag-and-drop PDF upload zone on the "New Document" page
2. Upload PDF to Supabase Storage (bucket: `documents`)
3. Create a `documents` row with status `draft`, store `file_path`
4. After upload, redirect to `/documents/[id]` (prepare view)
5. Render the PDF using PDF.js in the browser
6. Multi-page support with scrollable view (no page-by-page wizard)
7. Zoom controls (fit width, zoom in/out)
8. Loading states during upload and render

**Packages to install:**
- `pdfjs-dist` (PDF.js)
- `react-dropzone` (drag-and-drop file upload)

---

### Task B: Field Placement UI

**Files to create/modify:**
- `src/app/(dashboard)/documents/[id]/page.tsx` - Document prepare view
- `src/components/pdf/field-overlay.tsx` - Canvas overlay for placing fields on PDF
- `src/components/pdf/field-toolbar.tsx` - Toolbar to select field type (signature, date, name, initials, text, checkbox)
- `src/components/pdf/draggable-field.tsx` - Individual draggable/resizable field component

**Requirements:**
1. Document prepare view at `/documents/[id]`:
   - Left: PDF viewer with field overlay
   - Right sidebar: signer list (add name + email), field type selector, document settings
2. Field placement:
   - Click a field type in toolbar, then click on PDF to place it
   - OR use keyboard shortcuts: `S`=signature, `D`=date, `N`=name, `I`=initials
   - Fields are draggable and resizable on the PDF
   - Fields are color-coded per signer (signer 1 = blue, signer 2 = green, etc.)
   - Fields store percentage-based coordinates (0-100) for resolution independence
3. Signer management:
   - Add signers (name + email)
   - Assign fields to signers
   - Choose signing order (parallel or sequential)
4. Save field placements to the `fields` table
5. Auto-save drafts
6. "Send for Signature" button (UI only - actual sending is Phase 4)

**Packages to install:**
- `@dnd-kit/core` + `@dnd-kit/utilities` (drag and drop)

---

### Task C: AI Integration (Google Document AI + Gemini)

**Files to create/modify:**
- `supabase/functions/process-document/index.ts` - Edge Function for AI processing
- `src/lib/ai/document-ai.ts` - Google Document AI client helper
- `src/lib/ai/gemini.ts` - Gemini client for field detection + summarization
- `src/lib/ai/types.ts` - Types for AI responses (field suggestions, summaries)

**Requirements:**
1. Edge Function: `process-document`
   - Triggered after PDF upload (called from client or via database webhook)
   - Downloads PDF from Supabase Storage
   - Sends to Google Document AI for OCR + layout extraction
   - Sends extracted text + layout to Gemini with prompt:
     ```
     Given this contract text and layout, identify where each signer should:
     - Sign (signature fields)
     - Write their name
     - Write the date
     - Place initials
     Return as JSON: [{ type, page, x, y, width, height, label }]
     Also provide a plain-English summary of the contract in 3-5 bullet points.
     ```
   - Stores results in `documents.ai_fields` (JSONB) and `documents.ai_summary`
   - Creates audit_event: `created`

2. Client-side integration:
   - After upload, show "AI is analyzing your document..." loading state
   - Subscribe to document changes via Supabase Realtime
   - When AI results arrive, auto-place suggested fields on the PDF with subtle animation
   - Show AI summary in a collapsible card above the PDF
   - User can accept, modify, or dismiss AI suggestions
   - Badge on AI-suggested fields: "AI suggested"

3. Contract summary display:
   - Collapsible card: "Here's what this document is about"
   - 3-5 bullet points from Gemini
   - Disclaimer: "AI-generated summary. Always read the full document."

**Environment variables needed:**
```
GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_LOCATION=us (or eu)
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GEMINI_API_KEY=
```

---

## Task Dependencies

```
Task A (PDF Upload + Viewer)  ──┐
                                ├──> Task B (Field Placement UI)
Task C (AI Integration)  ───────┘
```

- Task A and C can run in parallel
- Task B depends on both (needs the PDF viewer to overlay fields on, needs AI results to auto-place)

## Definition of Done

After Phase 2, a user should be able to:
1. Click "+ New Document" on the dashboard
2. Drag-and-drop a PDF
3. See the PDF rendered in the browser
4. See AI auto-detect and suggest field placements
5. See a plain-English summary of the contract
6. Manually add/move/resize/delete fields on the PDF
7. Add signers and assign fields to them
8. Save the document as a draft

## Key Architecture Notes

- PDF.js runs client-side only (use `dynamic import` with `ssr: false` in Next.js)
- Field coordinates are percentage-based (0-100), not pixel-based
- AI processing is async - don't block the UI
- Use Supabase Realtime to push AI results to the client
- Edge Functions use the Supabase service role key for database access
- Supabase Storage bucket `documents` needs to be created with appropriate policies
