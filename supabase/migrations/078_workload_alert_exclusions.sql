-- Per-person alert exemptions: excluded users never trip workload/capacity or
-- activity-gap alerts (e.g. salaried email-team members without production tasks).
ALTER TABLE workload_alert_settings
  ADD COLUMN IF NOT EXISTS excluded_user_ids UUID[] NOT NULL DEFAULT '{}';
