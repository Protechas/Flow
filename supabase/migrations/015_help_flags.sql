-- Help flag requests from employees
CREATE TABLE IF NOT EXISTS help_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  board_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'need_clarification',
      'stuck_on_task',
      'missing_information',
      'system_issue',
      'need_qa_guidance',
      'workload_concern',
      'other'
    )
  ),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed')
  ),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  source TEXT NOT NULL DEFAULT 'task' CHECK (
    source IN ('task', 'dashboard', 'timer', 'wrap_up')
  ),
  wrap_up_id UUID,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  leader_note TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  dismissal_reason TEXT,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_flags_employee ON help_flags(employee_id);
CREATE INDEX IF NOT EXISTS idx_help_flags_status ON help_flags(status);
CREATE INDEX IF NOT EXISTS idx_help_flags_task ON help_flags(task_id);
CREATE INDEX IF NOT EXISTS idx_help_flags_department ON help_flags(department_id);

CREATE TABLE IF NOT EXISTS help_flag_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  escalation_minutes INTEGER NOT NULL DEFAULT 30,
  critical_idle_minutes INTEGER NOT NULL DEFAULT 60,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO help_flag_settings (enabled, escalation_minutes, critical_idle_minutes)
SELECT true, 30, 60
WHERE NOT EXISTS (SELECT 1 FROM help_flag_settings LIMIT 1);
