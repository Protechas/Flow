-- Team-specific wrap-up answers, keyed by the team operating model's
-- wrapUpFields ids (e.g. Advanced Projects' next_action / eta). Teams with no
-- extra wrap-up fields leave this null; existing rows are untouched.
alter table daily_wrap_ups
  add column if not exists sections jsonb;
