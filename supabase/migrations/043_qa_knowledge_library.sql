-- QA Knowledge Library: entry keys, indexing, storage bucket

ALTER TABLE qa_knowledge_entries
  ADD COLUMN IF NOT EXISTS entry_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS index_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE qa_knowledge_versions
  ADD COLUMN IF NOT EXISTS index_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS file_data_base64 TEXT;

CREATE INDEX IF NOT EXISTS idx_qa_knowledge_entries_entry_key ON qa_knowledge_entries(entry_key);
CREATE INDEX IF NOT EXISTS idx_qa_knowledge_entries_tags ON qa_knowledge_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_qa_knowledge_entries_index ON qa_knowledge_entries USING GIN (index_metadata);

CREATE TABLE IF NOT EXISTS qa_knowledge_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES qa_knowledge_entries(id) ON DELETE CASCADE,
  version_id UUID REFERENCES qa_knowledge_versions(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_knowledge_index_term ON qa_knowledge_index(lower(term));
CREATE INDEX IF NOT EXISTS idx_qa_knowledge_index_entry ON qa_knowledge_index(entry_id);

ALTER TABLE qa_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_knowledge_index ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_knowledge_index TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_knowledge_index TO service_role;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_entries_select ON qa_knowledge_entries
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_entries_mutate ON qa_knowledge_entries
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_versions_select ON qa_knowledge_versions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_versions_mutate ON qa_knowledge_versions
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_index_select ON qa_knowledge_index
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_index_mutate ON qa_knowledge_index
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qa-knowledge',
  'qa-knowledge',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_storage_read ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'qa-knowledge');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'qa-knowledge'
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_knowledge_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'qa-knowledge'
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
