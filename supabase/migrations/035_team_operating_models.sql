-- Configurable team operating models (labels, KPIs, tracking, forecast rules)

CREATE TABLE IF NOT EXISTS team_operating_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  definition JSONB NOT NULL,
  is_general BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_operating_models_active
  ON team_operating_models (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_team_operating_models_team
  ON team_operating_models (team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_operating_models_department
  ON team_operating_models (department_id) WHERE department_id IS NOT NULL;

ALTER TABLE team_operating_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read team operating models" ON team_operating_models;
CREATE POLICY "Authenticated read team operating models"
  ON team_operating_models FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write team operating models" ON team_operating_models;
CREATE POLICY "Authenticated write team operating models"
  ON team_operating_models FOR ALL TO authenticated USING (true) WITH CHECK (true);
