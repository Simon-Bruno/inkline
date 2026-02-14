-- Inkline Initial Schema Migration
-- Creates all tables, indexes, RLS policies, and triggers

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  title TEXT,
  avatar_url TEXT,
  saved_signature_url TEXT,
  signature_type TEXT CHECK (signature_type IN ('draw', 'type', 'upload')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  monthly_sends_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed', 'voided', 'expired')),
  file_path TEXT NOT NULL,
  signed_file_path TEXT,
  ai_summary TEXT,
  ai_fields JSONB,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  message_to_signers TEXT,
  signing_order TEXT DEFAULT 'parallel' CHECK (signing_order IN ('parallel', 'sequential')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Signers (people who need to sign a document)
CREATE TABLE public.signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'signer' CHECK (role IN ('signer', 'viewer', 'approver')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'declined')),
  order_index INT DEFAULT 0,
  access_token UUID DEFAULT gen_random_uuid() UNIQUE,
  signed_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Signature Fields (placed on the document)
CREATE TABLE public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES public.signers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('signature', 'initials', 'date', 'name', 'text', 'checkbox')),
  page INT NOT NULL,
  x FLOAT NOT NULL CHECK (x >= 0 AND x <= 100),
  y FLOAT NOT NULL CHECK (y >= 0 AND y <= 100),
  width FLOAT NOT NULL CHECK (width >= 0 AND width <= 100),
  height FLOAT NOT NULL CHECK (height >= 0 AND height <= 100),
  value TEXT,
  is_required BOOLEAN DEFAULT true,
  ai_suggested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Events (tamper-evident log)
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.signers(id),
  actor_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'sent', 'viewed', 'signed', 'completed', 'voided', 'reminder_sent', 'downloaded', 'field_placed')),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Templates (V2, but schema ready)
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  fields JSONB,
  signer_roles JSONB,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_documents_owner ON public.documents(owner_id, status);
CREATE INDEX idx_documents_status ON public.documents(status) WHERE status = 'pending';
CREATE INDEX idx_signers_document ON public.signers(document_id);
CREATE INDEX idx_signers_token ON public.signers(access_token);
CREATE INDEX idx_signers_email ON public.signers(email);
CREATE INDEX idx_fields_document ON public.fields(document_id);
CREATE INDEX idx_fields_signer ON public.fields(signer_id);
CREATE INDEX idx_audit_document ON public.audit_events(document_id, created_at);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: profiles
-- ============================================================================

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- RLS POLICIES: documents
-- ============================================================================

CREATE POLICY "Owner can read own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Authenticated users can create documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete draft documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = owner_id AND status = 'draft');

-- ============================================================================
-- RLS POLICIES: signers
-- ============================================================================

CREATE POLICY "Owner can read signers on own documents"
  ON public.signers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = signers.document_id
        AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Signers can read own record via access token"
  ON public.signers FOR SELECT
  USING (
    access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
  );

CREATE POLICY "Owner can insert signers on own documents"
  ON public.signers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = signers.document_id
        AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update signers on own documents"
  ON public.signers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = signers.document_id
        AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete signers on own documents"
  ON public.signers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = signers.document_id
        AND documents.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: fields
-- ============================================================================

CREATE POLICY "Owner can read fields on own documents"
  ON public.fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = fields.document_id
        AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Assigned signer can read own fields"
  ON public.fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.signers
      WHERE signers.id = fields.signer_id
        AND signers.access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
    )
  );

CREATE POLICY "Owner can insert fields on own documents"
  ON public.fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = fields.document_id
        AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Assigned signer can update field value"
  ON public.fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.signers
      WHERE signers.id = fields.signer_id
        AND signers.access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
    )
  );

CREATE POLICY "Owner can delete fields on own documents"
  ON public.fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = fields.document_id
        AND documents.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: audit_events (APPEND-ONLY: no UPDATE or DELETE policies)
-- ============================================================================

CREATE POLICY "Owner can read audit events on own documents"
  ON public.audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = audit_events.document_id
        AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Signers can read audit events via access token"
  ON public.audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.signers
      WHERE signers.document_id = audit_events.document_id
        AND signers.access_token = (current_setting('request.headers', true)::json->>'x-signer-token')::uuid
    )
  );

-- INSERT is intentionally omitted for anon/authenticated roles.
-- Audit events should only be inserted via service role (edge functions).
-- No UPDATE or DELETE policies exist, making this table append-only.

-- ============================================================================
-- RLS POLICIES: templates
-- ============================================================================

CREATE POLICY "Owner can read own templates"
  ON public.templates FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner can create templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own templates"
  ON public.templates FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete own templates"
  ON public.templates FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function: auto-create profile when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
