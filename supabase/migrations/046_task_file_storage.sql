-- Task file uploads: persist file content in Supabase Storage.
-- Before this migration only upload metadata was saved; file bytes lived in
-- server memory and were lost on every serverless recycle, so uploaded task
-- documents could never be viewed again. Rows created before this migration
-- have no storage_path and their content is unrecoverable (re-upload needed).

ALTER TABLE task_file_uploads
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-files', 'task-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Analysts of any role upload completed work to their tasks, so inserts are
-- open to authenticated users; the app layer gates which task they may edit.
CREATE POLICY task_files_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-files');

CREATE POLICY task_files_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files');

CREATE POLICY task_files_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-files'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
    )
  );
