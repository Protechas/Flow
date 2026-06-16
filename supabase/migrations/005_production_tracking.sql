-- Production tracking: shift clock, task timers, submissions, file uploads

CREATE TABLE IF NOT EXISTS time_clock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  total_minutes INTEGER,
  clock_out_type TEXT CHECK (clock_out_type IN ('lunch', 'out')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'edited')),
  edited_by UUID REFERENCES users(id),
  edit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_active_minutes INTEGER NOT NULL DEFAULT 0,
  pause_events JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  is_correction_session BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url_or_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_submission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_file_count INTEGER NOT NULL DEFAULT 0,
  total_task_minutes INTEGER NOT NULL DEFAULT 0,
  average_minutes_per_document NUMERIC(10,2) NOT NULL DEFAULT 0,
  documents_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_task_minutes INTEGER NOT NULL DEFAULT 0,
  correction_task_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qa_review_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES task_submission_records(id) ON DELETE SET NULL,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  notes TEXT,
  correction_required BOOLEAN NOT NULL DEFAULT false,
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_user ON time_clock_entries(user_id, clock_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_time_user ON task_time_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_time_task ON task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_task_files_task ON task_file_uploads(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON task_submission_records(task_id, submitted_at DESC);
