-- Workload alert records for employee low-work monitoring
CREATE TABLE IF NOT EXISTS workload_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (
    alert_type IN (
      'running_out_of_work',
      'no_assigned_work',
      'needs_more_work_soon',
      'task_almost_complete',
      'needs_estimate'
    )
  ),
  severity TEXT NOT NULL CHECK (
    severity IN ('info', 'warning', 'critical', 'needs_review')
  ),
  remaining_hours NUMERIC(10, 2),
  current_task_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'snoozed', 'dismissed', 'reviewed')
  ),
  recommended_action TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workload_alerts_employee ON workload_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_workload_alerts_status ON workload_alerts(status);
CREATE INDEX IF NOT EXISTS idx_workload_alerts_department ON workload_alerts(department_id);

CREATE TABLE IF NOT EXISTS workload_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  work_remaining_threshold_hours NUMERIC(6, 2) NOT NULL DEFAULT 2,
  snooze_duration_hours INTEGER NOT NULL DEFAULT 24,
  department_ids UUID[] NOT NULL DEFAULT '{}',
  team_ids UUID[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO workload_alert_settings (enabled, work_remaining_threshold_hours, snooze_duration_hours)
SELECT true, 2, 24
WHERE NOT EXISTS (SELECT 1 FROM workload_alert_settings LIMIT 1);
