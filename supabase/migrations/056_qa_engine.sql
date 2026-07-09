-- QA Intelligence Engine Phase 1 + ID3 rules editor.

-- Mark's rules: rows of field/value pairs maintained in the UI, used by
-- ID3 comparisons instead of uploading a rules workbook every time.
CREATE TABLE IF NOT EXISTS id3_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE id3_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.id3_rules TO service_role;

-- QA Engine findings: one row per detected issue, with a review workflow.
CREATE TABLE IF NOT EXISTS qa_engine_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  source_file TEXT NOT NULL,
  sheet_name TEXT,
  row_number INTEGER,
  column_name TEXT,
  expected TEXT,
  found TEXT,
  explanation TEXT,
  suggested_task_title TEXT,
  suggested_task_description TEXT,
  suggested_priority TEXT,
  suggested_assignee TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed', 'ready_for_task')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qa_engine_findings_run ON qa_engine_findings(run_id);
ALTER TABLE qa_engine_findings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_engine_findings TO service_role;

-- Register + activate the QA Engine in the engine catalog.
INSERT INTO validation_engines (id, label, description, status)
VALUES (
  'qa_engine',
  'QA Engine',
  'Rules-based QA scan: parse uploaded workbooks, detect blanks, duplicates, inconsistencies, and cross-file mismatches',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  status = 'active';
