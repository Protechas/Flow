ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS planning_complexity_level TEXT DEFAULT 'standard';
