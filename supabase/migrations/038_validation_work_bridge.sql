-- Validation finding ↔ work item bridge (Phase 4)

CREATE TABLE IF NOT EXISTS validation_finding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_finding_id UUID NOT NULL REFERENCES validation_findings(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  batch_id UUID,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (validation_finding_id, work_item_id)
);

CREATE INDEX IF NOT EXISTS idx_validation_finding_tasks_finding ON validation_finding_tasks(validation_finding_id);
CREATE INDEX IF NOT EXISTS idx_validation_finding_tasks_work_item ON validation_finding_tasks(work_item_id);
CREATE INDEX IF NOT EXISTS idx_validation_finding_tasks_batch ON validation_finding_tasks(batch_id);

ALTER TABLE validation_finding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY validation_finding_tasks_select ON validation_finding_tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY validation_finding_tasks_insert ON validation_finding_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );

-- Extend findings with QA tracking fields
ALTER TABLE validation_findings
  ADD COLUMN IF NOT EXISTS qa_status TEXT CHECK (qa_status IN ('pending', 'pass', 'fail', 'n/a')),
  ADD COLUMN IF NOT EXISTS resolution_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_validation_findings_work_item ON validation_findings(work_item_id);
