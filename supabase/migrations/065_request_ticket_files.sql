-- Ticket attachments: the deliverable travels with the request. The analyst
-- drops the finished doc on the ticket; the requester pulls it off into their
-- email. Files live in Supabase Storage, metadata here.
CREATE TABLE IF NOT EXISTS request_ticket_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES request_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_ticket_files_ticket
  ON request_ticket_files(ticket_id, uploaded_at DESC);

ALTER TABLE request_ticket_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY request_ticket_files_select ON request_ticket_files
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY request_ticket_files_insert ON request_ticket_files
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY request_ticket_files_delete ON request_ticket_files
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('request-files', 'request-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Anyone on the team attaches to tickets they're part of; the app layer
-- gates which ticket. Deletes stay with leadership plus the uploader (app).
CREATE POLICY request_files_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'request-files');

CREATE POLICY request_files_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-files');

CREATE POLICY request_files_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'request-files');
