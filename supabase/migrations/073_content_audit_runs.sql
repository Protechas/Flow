-- Content Audit run log: the checking runs entirely in the browser (Tools
-- rule — zero server cost); only the SCOREBOARD is persisted. One small
-- aggregate row per audit run — never document contents or per-file rows.
CREATE TABLE IF NOT EXISTS content_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by UUID REFERENCES users(id) ON DELETE SET NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  docs_checked INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  flagged INTEGER NOT NULL,
  unreadable INTEGER NOT NULL,
  -- flag code -> occurrence count, e.g. {"naming_grammar": 4, "oversize": 1}
  fail_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- [{"label":"2022 Chevrolet Silverado 1500","missing":["NV"],"docs":6,"flagged":1}]
  models JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Tiny runs are spot checks; they log but stay out of the trend line.
  is_spot_check BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_content_audit_runs_at ON content_audit_runs(run_at DESC);

ALTER TABLE content_audit_runs ENABLE ROW LEVEL SECURITY;
-- Reads and writes go through the app's service role with app-layer checks.
