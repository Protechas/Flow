-- Work visibility settings (org-wide)
CREATE TABLE IF NOT EXISTS work_visibility_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  activity_gap_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  task_tracking_compliance_target_pct INTEGER NOT NULL DEFAULT 85,
  daily_report_required BOOLEAN NOT NULL DEFAULT true,
  capacity_alert_threshold_pct INTEGER NOT NULL DEFAULT 90,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Extended wrap-up fields for compliance metrics
ALTER TABLE daily_wrap_ups
  ADD COLUMN IF NOT EXISTS clocked_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS recorded_task_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS unassigned_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS task_tracking_compliance_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS activity_documentation_category TEXT,
  ADD COLUMN IF NOT EXISTS activity_documentation_note TEXT;

-- Program intelligence daily snapshots
CREATE TABLE IF NOT EXISTS project_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scope TEXT NOT NULL CHECK (scope IN ('portfolio', 'program')),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  health_score INTEGER,
  avg_health_score INTEGER,
  capacity_load_pct INTEGER,
  avg_capacity_load_pct INTEGER,
  at_risk_count INTEGER,
  risk_tier TEXT,
CREATE INDEX IF NOT EXISTS idx_intel_snapshots_date ON project_intelligence_snapshots (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_intel_snapshots_program ON project_intelligence_snapshots (project_id, snapshot_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intel_portfolio_daily
  ON project_intelligence_snapshots (snapshot_date)
  WHERE scope = 'portfolio' AND project_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_intel_program_daily
  ON project_intelligence_snapshots (snapshot_date, project_id)
  WHERE scope = 'program' AND project_id IS NOT NULL;
