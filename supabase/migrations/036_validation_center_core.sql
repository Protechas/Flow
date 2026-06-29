-- Validation Center core tables (Phase 2)
-- Engines registry, runs, input/output files, job queue, settings

CREATE TABLE IF NOT EXISTS validation_engines (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('active', 'planned', 'future')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO validation_engines (id, label, description, status) VALUES
  ('si_library_audit', 'SI Library Audit', 'Manufacturer chart vs OneDrive export matching', 'active'),
  ('si_library_external', 'SI External Report Validation', 'External report validation against audited library', 'planned'),
  ('id3_validation', 'ID³ Validation', 'ID³ deliverable validation', 'future'),
  ('oem_validation', 'OEM Validation', 'OEM-specific validation', 'future'),
  ('document_validation', 'Document Validation', 'Document completeness validation', 'future')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS validation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engine_id TEXT NOT NULL REFERENCES validation_engines(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  manufacturer TEXT,
  title TEXT,
  compliance_rate NUMERIC(6,2),
  run_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_runs_status ON validation_runs(status);
CREATE INDEX IF NOT EXISTS idx_validation_runs_engine ON validation_runs(engine_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_created ON validation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_runs_manufacturer ON validation_runs(manufacturer);

CREATE TABLE IF NOT EXISTS validation_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_files_run ON validation_files(run_id);

CREATE TABLE IF NOT EXISTS validation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL REFERENCES validation_engines(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_validation_jobs_status ON validation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_validation_jobs_run ON validation_jobs(run_id);

CREATE TABLE IF NOT EXISTS validation_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engine_id TEXT NOT NULL REFERENCES validation_engines(id),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engine_id)
);

INSERT INTO validation_settings (engine_id, settings) VALUES
  ('si_library_audit', '{}'::jsonb)
ON CONFLICT (engine_id) DO NOTHING;

ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_engines ENABLE ROW LEVEL SECURITY;

CREATE POLICY validation_engines_select ON validation_engines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_runs_select ON validation_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_runs_insert ON validation_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );

CREATE POLICY validation_runs_update ON validation_runs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );

CREATE POLICY validation_files_select ON validation_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_files_insert ON validation_files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY validation_jobs_select ON validation_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_jobs_update ON validation_jobs
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY validation_settings_select ON validation_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_settings_update ON validation_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'validation-files',
  'validation-files',
  false,
  104857600,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY validation_files_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'validation-files');

CREATE POLICY validation_files_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'validation-files'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'validation_run_complete';
