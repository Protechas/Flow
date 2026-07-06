-- Backfill time_logs from completed task-timer sessions.
-- The production task timers (task_time_entries) never wrote time_logs, so
-- actual_hours, people profiles, and scorecards all showed 0 hours. The app
-- now mirrors every completed timer session into time_logs (row id = the
-- task_time_entry id, so this backfill and the app bridge are idempotent).
-- The existing time_logs_sync_hours trigger recomputes work_items.actual_hours
-- for every inserted row.
--
-- log_date uses the organization timezone (America/Chicago — matches the
-- NEXT_PUBLIC_FLOW_TIMEZONE default the app buckets days with).

INSERT INTO time_logs (id, work_item_id, user_id, hours, log_date, notes, created_at)
SELECT
  t.id,
  t.task_id,
  t.user_id,
  ROUND(t.total_active_minutes / 60.0, 2),
  ((COALESCE(t.completed_at, t.started_at)) AT TIME ZONE 'America/Chicago')::date,
  'Task timer',
  t.created_at
FROM task_time_entries t
WHERE t.status = 'completed'
  AND t.total_active_minutes > 0
  -- Guard against rows whose task or user was deleted
  AND EXISTS (SELECT 1 FROM work_items w WHERE w.id = t.task_id)
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)
ON CONFLICT (id) DO NOTHING;
