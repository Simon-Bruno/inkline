-- Fix: infinite recursion between documents ↔ signers RLS policies
-- Solution: SECURITY DEFINER function bypasses RLS when checking signer token

-- 1. Drop the recursive policies
DROP POLICY IF EXISTS "Signers can read document via access token" ON public.documents;
DROP POLICY IF EXISTS "Signers can update document via access token" ON public.documents;

-- 2. Create a SECURITY DEFINER function that checks signer access without triggering RLS
CREATE OR REPLACE FUNCTION public.signer_has_document_access(doc_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signers
    WHERE signers.document_id = doc_id
      AND signers.access_token = (
        current_setting('request.headers', true)::json->>'x-signer-token'
      )::uuid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Recreate policies using the function (no recursion)
CREATE POLICY "Signers can read document via access token"
  ON public.documents FOR SELECT
  USING (public.signer_has_document_access(id));

CREATE POLICY "Signers can update document via access token"
  ON public.documents FOR UPDATE
  USING (public.signer_has_document_access(id));

-- 4. Also fix the audit_events signer INSERT policy (same recursion risk)
DROP POLICY IF EXISTS "Signers can insert audit events via access token" ON public.audit_events;

CREATE POLICY "Signers can insert audit events via access token"
  ON public.audit_events FOR INSERT
  WITH CHECK (public.signer_has_document_access(document_id));
