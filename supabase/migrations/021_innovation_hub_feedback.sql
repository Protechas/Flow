-- Innovation Hub: user feedback, ideas, bugs, and feature requests

CREATE TYPE feedback_category AS ENUM (
  'idea',
  'bug',
  'issue',
  'feature_request',
  'question'
);

CREATE TYPE feedback_priority AS ENUM ('low', 'medium', 'high');

CREATE TYPE feedback_status AS ENUM (
  'new',
  'investigating',
  'planned',
  'fixed',
  'rejected'
);

CREATE TABLE feedback_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT,
  category feedback_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority feedback_priority NOT NULL DEFAULT 'medium',
  screenshot_url TEXT,
  screenshot_storage_path TEXT,
  screenshot_mime_type TEXT,
  screenshot_file_name TEXT,
  page_url TEXT,
  app_version TEXT,
  device_info TEXT,
  status feedback_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_submissions_status ON feedback_submissions(status);
CREATE INDEX idx_feedback_submissions_category ON feedback_submissions(category);
CREATE INDEX idx_feedback_submissions_priority ON feedback_submissions(priority);
CREATE INDEX idx_feedback_submissions_user ON feedback_submissions(user_id);
CREATE INDEX idx_feedback_submissions_created ON feedback_submissions(created_at DESC);
CREATE INDEX idx_feedback_submissions_assigned ON feedback_submissions(assigned_to);

ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit feedback for themselves
CREATE POLICY feedback_insert_own ON feedback_submissions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins and managers can view all feedback
CREATE POLICY feedback_select_manage ON feedback_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );

-- Admins and managers can update feedback (status, assignment, notes)
CREATE POLICY feedback_update_manage ON feedback_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY feedback_attachments_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );

CREATE POLICY feedback_attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-attachments');
