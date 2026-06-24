-- Project fields used by the app but missing from earlier migrations
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS priority work_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS project_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS idx_projects_project_owner ON projects(project_owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
