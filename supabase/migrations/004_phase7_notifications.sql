-- Phase 7: expanded notifications + workflow support

-- Extend notification_type enum with Phase 7 values
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_assignment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_due_soon';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_overdue';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'qa_review_needed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'qa_passed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'correction_issued';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'correction_resolved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'comment_mention';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'file_uploaded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'project_at_risk';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'employee_overloaded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'work_stuck';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id TEXT;

-- Backfill message from body
UPDATE public.notifications SET message = body WHERE message IS NULL AND body IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON public.notifications(related_entity_type, related_entity_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service insert notifications" ON public.notifications;
CREATE POLICY "Service insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
