-- Program Builder: persist how a program organizes work (labels + structure recovery)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS structure_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_structure_mode ON projects(structure_mode);
