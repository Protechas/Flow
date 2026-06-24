-- Remove demo / placeholder daily report rows from production databases.
-- Safe: only targets users with @flow.local emails (development seed accounts).

DELETE FROM daily_wrap_up_overrides
WHERE user_id IN (
  SELECT id FROM users WHERE email ILIKE '%@flow.local'
);

DELETE FROM daily_wrap_ups
WHERE user_id IN (
  SELECT id FROM users WHERE email ILIKE '%@flow.local'
);

-- Wrap-ups with no matching user (orphans)
DELETE FROM daily_wrap_ups w
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = w.user_id);

DELETE FROM daily_wrap_up_overrides o
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id);
