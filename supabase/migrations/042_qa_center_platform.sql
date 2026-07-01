-- QA Center platform: knowledge library, gold standards, configurable rules, document validations

CREATE TABLE IF NOT EXISTS qa_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  active_version_id UUID,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_knowledge_entries_category ON qa_knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_qa_knowledge_entries_active ON qa_knowledge_entries(is_archived) WHERE is_archived = false;

CREATE TABLE IF NOT EXISTS qa_knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES qa_knowledge_entries(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  file_name TEXT,
  storage_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  change_notes TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_qa_knowledge_versions_entry ON qa_knowledge_versions(entry_id);

CREATE TABLE IF NOT EXISTS qa_gold_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  manufacturer TEXT,
  make TEXT,
  model TEXT,
  year INT,
  component TEXT,
  source_run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,
  source_validation_id UUID,
  validation_score NUMERIC(5,2),
  storage_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_gold_standards_mfr ON qa_gold_standards(manufacturer);
CREATE INDEX IF NOT EXISTS idx_qa_gold_standards_active ON qa_gold_standards(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS qa_validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  layer TEXT NOT NULL CHECK (layer IN ('file', 'content', 'mcc', 'business', 'scoring')),
  label TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  weight NUMERIC(6,2) NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_document_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  upload_batch_id UUID,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  manufacturer TEXT,
  make TEXT,
  model TEXT,
  year INT,
  component TEXT,
  analyst_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_analyst_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  work_package_id UUID,
  qa_score NUMERIC(5,2),
  confidence_pct NUMERIC(5,2),
  verdict TEXT CHECK (verdict IN ('pass', 'warning', 'fail', 'critical')),
  estimated_review_minutes INT,
  layer_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_review JSONB NOT NULL DEFAULT '{}'::jsonb,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qa_doc_validations_status ON qa_document_validations(status);
CREATE INDEX IF NOT EXISTS idx_qa_doc_validations_batch ON qa_document_validations(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_qa_doc_validations_analyst ON qa_document_validations(analyst_id);

-- Seed default rule keys (configurable via Rule Engine UI)
INSERT INTO qa_validation_rules (rule_key, layer, label, description, config, weight) VALUES
  ('max_file_size_mb', 'file', 'Maximum file size', 'Reject files above configured size', '{"max_mb": 50}'::jsonb, 1),
  ('allowed_extensions', 'file', 'Accepted file types', 'PDF, DOCX, XLSX, ZIP', '{"extensions": ["pdf","docx","xlsx","zip"]}'::jsonb, 1),
  ('landscape_orientation', 'file', 'Landscape orientation', 'PDF pages must be landscape', '{"required": true}'::jsonb, 0.8),
  ('naming_convention', 'business', 'Naming convention', 'Manufacturer/year/component naming pattern', '{"pattern": null}'::jsonb, 1),
  ('required_sections', 'content', 'Required SI sections', 'System Description, R&I, Calibration, etc.', '{"sections": []}'::jsonb, 1.2),
  ('mcc_verification', 'mcc', 'Manufacturer Component Chart', 'Year/make/model/component mapping', '{}'::jsonb, 1.5),
  ('gold_standard_compare', 'content', 'Gold standard comparison', 'Compare against approved reference documents', '{"enabled": true}'::jsonb, 1),
  ('scoring_weights', 'scoring', 'QA score weights', 'Layer weights for composite score', '{"file": 0.15, "content": 0.35, "mcc": 0.25, "business": 0.15, "ai": 0.10}'::jsonb, 1)
  ON CONFLICT (rule_key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_knowledge_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_knowledge_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_gold_standards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_validation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_document_validations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_knowledge_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_knowledge_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_gold_standards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_validation_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_document_validations TO service_role;

DO $$ BEGIN
  ALTER TABLE qa_knowledge_entries
    ADD CONSTRAINT qa_knowledge_entries_active_version_fk
    FOREIGN KEY (active_version_id) REFERENCES qa_knowledge_versions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
