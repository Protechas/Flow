-- AI features, phase 1: advisory Claude triage of validation run findings
-- plus app-wide AI usage metering. See docs/AI_SECURITY.md.

-- One row per triage pass; the latest row per run is the one shown in the UI.
CREATE TABLE IF NOT EXISTS validation_ai_triage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  model TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  clusters JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings_analyzed INTEGER NOT NULL DEFAULT 0,
  findings_total INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_ai_triage_run
  ON validation_ai_triage(validation_run_id, created_at DESC);

ALTER TABLE validation_ai_triage ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.validation_ai_triage TO service_role;

-- Every Claude API call in the app logs one row here (AI security rule #5),
-- so spend is attributable per feature and per user.
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  run_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(feature, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.ai_usage_log TO service_role;
