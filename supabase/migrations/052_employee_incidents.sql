-- Employee evaluation: a manager-facing incident log per employee.
-- Complements automatic signals (clock corrections, missed wrap-ups, QA
-- corrections) with manually recorded issues.

CREATE TABLE IF NOT EXISTS employee_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN (
      'time_clock', 'task_timer', 'daily_report', 'qa_quality',
      'attendance', 'conduct', 'process', 'other'
    )
  ),
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'serious')),
  summary TEXT NOT NULL,
  notes TEXT,
  occurred_on DATE NOT NULL,
  task_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_incidents_employee
  ON employee_incidents(employee_id, occurred_on DESC);

-- Locked down: the app reads/writes via the service-role client with
-- app-layer authorization (leads and up, scoped to their branch).
ALTER TABLE employee_incidents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_incidents TO service_role;
