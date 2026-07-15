-- SHA-256 of uploaded file bytes. Duplicate-document detection previously
-- keyed on file name + size, which a rename defeats ("Ram-Door[].pdf").
-- Bytes don't lie. Old rows stay NULL and fall back to the name+size key.
ALTER TABLE task_file_uploads ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_task_file_uploads_task_hash
  ON task_file_uploads(task_id, content_hash);
