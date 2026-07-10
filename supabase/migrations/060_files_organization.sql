-- Files organization: folders + tags + in-Flow editable content for company
-- documents (SOP library). Also adds the missing UPDATE policy so documents
-- can be edited at all.

CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders(parent_id);

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_folders_select ON document_folders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY document_folders_write ON document_folders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );

-- Organization + in-Flow edited copy. content_html is the working copy edited
-- inside Flow; the original upload in storage is never modified.
ALTER TABLE company_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_html TEXT,
  ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_company_documents_folder ON company_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_tags ON company_documents USING GIN(tags);

-- 019 defined SELECT/INSERT/DELETE policies but no UPDATE — required for
-- editing content, moving between folders, and tagging.
DROP POLICY IF EXISTS company_documents_update ON company_documents;
CREATE POLICY company_documents_update ON company_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );
