-- Content Audit runs keep their full result snapshot so the dashboard
-- survives leaving the page: per-doc flags, model coverage, and Eddy
-- reports. Still NEVER document contents — findings metadata only.
ALTER TABLE content_audit_runs ADD COLUMN IF NOT EXISTS details JSONB;
