-- SOPs as the source of truth: published revisions + mandatory employee
-- acknowledgment with an audit trail ("who accepted what, when").

-- One row per published revision of a company document. Snapshots the
-- content so the diff and the acknowledged version are permanent record.
CREATE TABLE IF NOT EXISTS document_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES company_documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  -- Block-level diff vs the prior revision: [{ type: added|changed|removed, html, prev_html }]
  changed_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT TRUE,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_document_revisions_document
  ON document_revisions(document_id, revision_number DESC);

ALTER TABLE document_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_revisions_select ON document_revisions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY document_revisions_insert ON document_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );

-- One row per user per revision they have read and accepted.
CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  revision_id UUID NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (revision_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_acknowledgments_user
  ON document_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_document_acknowledgments_revision
  ON document_acknowledgments(revision_id);

ALTER TABLE document_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_acknowledgments_select ON document_acknowledgments
  FOR SELECT TO authenticated
  USING (true);

-- Users may only acknowledge for themselves.
CREATE POLICY document_acknowledgments_insert ON document_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fast "what's pending for this user" lookups: the current revision pointer
-- lives on the document itself.
ALTER TABLE company_documents
  ADD COLUMN IF NOT EXISTS current_revision_id UUID REFERENCES document_revisions(id) ON DELETE SET NULL;
