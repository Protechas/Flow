-- Smart due-date forecasting: org settings + task/project forecast columns

CREATE TABLE IF NOT EXISTS forecast_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minutes_per_document NUMERIC(6,2) NOT NULL DEFAULT 7,
  productive_hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 6.5,
  working_days INT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO forecast_settings (minutes_per_document, productive_hours_per_day, working_days)
SELECT 7, 6.5, ARRAY[1, 2, 3, 4, 5]
WHERE NOT EXISTS (SELECT 1 FROM forecast_settings LIMIT 1);

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS estimated_document_count INTEGER,
  ADD COLUMN IF NOT EXISTS complexity_level TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS complexity_multiplier NUMERIC(4,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS estimated_minutes_per_document NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS estimated_work_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_work_hours NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS estimated_work_days NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS suggested_due_date DATE,
  ADD COLUMN IF NOT EXISTS manual_due_date DATE,
  ADD COLUMN IF NOT EXISTS due_date_status TEXT,
  ADD COLUMN IF NOT EXISTS forecast_last_calculated TIMESTAMPTZ;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS estimated_total_documents INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_total_hours NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS estimated_total_work_days NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS suggested_project_due_date DATE,
  ADD COLUMN IF NOT EXISTS manual_project_due_date DATE,
  ADD COLUMN IF NOT EXISTS project_due_date_status TEXT,
  ADD COLUMN IF NOT EXISTS forecast_confidence INTEGER;

CREATE INDEX IF NOT EXISTS idx_work_items_due_date_status ON work_items(due_date_status);
CREATE INDEX IF NOT EXISTS idx_work_items_suggested_due ON work_items(suggested_due_date);
CREATE INDEX IF NOT EXISTS idx_projects_forecast_status ON projects(project_due_date_status);
