-- Operator-built team dashboard packs (project scope, KPIs, nav, access)

CREATE TABLE IF NOT EXISTS team_dashboard_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  definition JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_dashboard_packs_active
  ON team_dashboard_packs (is_active, sort_order);

ALTER TABLE team_dashboard_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read team dashboard packs" ON team_dashboard_packs;
CREATE POLICY "Authenticated read team dashboard packs"
  ON team_dashboard_packs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write team dashboard packs" ON team_dashboard_packs;
CREATE POLICY "Authenticated write team dashboard packs"
  ON team_dashboard_packs FOR ALL TO authenticated USING (true) WITH CHECK (true);
