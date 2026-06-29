-- Validation findings (Phase 3)

CREATE TABLE IF NOT EXISTS validation_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL REFERENCES validation_engines(id),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_review', 'task_created', 'corrected', 'resolved', 'dismissed')
  ),
  root_cause TEXT NOT NULL DEFAULT 'needs_investigation' CHECK (
    root_cause IN (
      'library_issue',
      'oem_data_issue',
      'import_issue',
      'employee_error',
      'missing_data',
      'rule_mismatch',
      'system_logic_issue',
      'unknown',
      'needs_investigation'
    )
  ),
  confidence_score INT NOT NULL DEFAULT 0,
  suggested_correction TEXT,
  manufacturer TEXT,
  match_status TEXT,
  affected_record_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  search_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_findings_run ON validation_findings(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_validation_findings_severity ON validation_findings(severity);
CREATE INDEX IF NOT EXISTS idx_validation_findings_status ON validation_findings(status);
CREATE INDEX IF NOT EXISTS idx_validation_findings_root_cause ON validation_findings(root_cause);
CREATE INDEX IF NOT EXISTS idx_validation_findings_manufacturer ON validation_findings(manufacturer);
CREATE INDEX IF NOT EXISTS idx_validation_findings_created ON validation_findings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_findings_search ON validation_findings USING gin (to_tsvector('english', search_text));

ALTER TABLE validation_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY validation_findings_select ON validation_findings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_findings_insert ON validation_findings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY validation_findings_update ON validation_findings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );
