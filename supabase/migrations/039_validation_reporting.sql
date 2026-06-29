-- Validation reporting & revalidation links (Phase 5)

ALTER TABLE validation_runs
  ADD COLUMN IF NOT EXISTS prior_run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_validation_runs_prior ON validation_runs(prior_run_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_project ON validation_runs(project_id);

ALTER TABLE validation_findings
  ADD COLUMN IF NOT EXISTS prior_finding_id UUID REFERENCES validation_findings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_validation_findings_prior ON validation_findings(prior_finding_id);

CREATE TABLE IF NOT EXISTS validation_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  manufacturer TEXT,
  compliance_rate NUMERIC(6,2),
  open_findings INT NOT NULL DEFAULT 0,
  critical_findings INT NOT NULL DEFAULT 0,
  resolved_findings INT NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_scores_run ON validation_scores(run_id);
CREATE INDEX IF NOT EXISTS idx_validation_scores_snapshot ON validation_scores(snapshot_at DESC);

ALTER TABLE validation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY validation_scores_select ON validation_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_scores_insert ON validation_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );
