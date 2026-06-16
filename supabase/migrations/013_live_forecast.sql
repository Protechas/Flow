-- Live forecasting: planning vs active modes tied to actual task start

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forecast_mode TEXT DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS planning_due_date DATE,
  ADD COLUMN IF NOT EXISTS active_due_date DATE,
  ADD COLUMN IF NOT EXISTS forecast_start_date DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_remaining_documents INTEGER,
  ADD COLUMN IF NOT EXISTS current_documents_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_production_rate NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS forecast_last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_forecast_status TEXT,
  ADD COLUMN IF NOT EXISTS forecast_variance_days NUMERIC(8,2);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS planning_project_due_date DATE,
  ADD COLUMN IF NOT EXISTS active_project_due_date DATE;

CREATE INDEX IF NOT EXISTS idx_work_items_forecast_mode ON work_items(forecast_mode);
CREATE INDEX IF NOT EXISTS idx_work_items_live_forecast_status ON work_items(live_forecast_status);
CREATE INDEX IF NOT EXISTS idx_work_items_started_at ON work_items(started_at);
