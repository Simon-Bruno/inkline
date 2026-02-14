-- Migration: Add RLS policies for the signing flow
-- Signers need to read documents, update their own status, and insert audit events

-- ============================================================================
-- Documents: signers can read their document via access token
-- ============================================================================

CREATE POLICY "Signers can read document via access token"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.signers
      WHERE signers.document_id = documents.id
        AND signers.access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
    )
  );

-- ============================================================================
-- Signers: signers can update their own record (status, viewed_at, signed_at, ip, ua)
-- ============================================================================

CREATE POLICY "Signers can update own record via access token"
  ON public.signers FOR UPDATE
  USING (
    access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
  );

-- ============================================================================
-- Documents: signers can update document status (for marking completed)
-- ============================================================================

CREATE POLICY "Signers can update document via access token"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.signers
      WHERE signers.document_id = documents.id
        AND signers.access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
    )
  );

-- ============================================================================
-- Audit events: allow insert from anon/authenticated with valid signer token
-- ============================================================================

CREATE POLICY "Signers can insert audit events via access token"
  ON public.audit_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.signers
      WHERE signers.document_id = audit_events.document_id
        AND signers.access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
    )
  );

-- Also allow authenticated users (document owners) to insert audit events
CREATE POLICY "Authenticated users can insert audit events on own documents"
  ON public.audit_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = audit_events.document_id
        AND documents.owner_id = auth.uid()
    )
  );
