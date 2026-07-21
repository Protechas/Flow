-- Manager Friday updates (team-workspace engine, first tenant: Advanced
-- Projects). One row per manager per week; answers keyed by the team
-- operating model's managerUpdate.fields ids. Server-side (service role)
-- reads/writes only — RLS on with no broad policies.
CREATE TABLE IF NOT EXISTS manager_weekly_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- The Friday (org timezone) of the week this update covers.
  week_of DATE NOT NULL,
  sections JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_of)
);

CREATE INDEX IF NOT EXISTS idx_manager_weekly_updates_week
  ON manager_weekly_updates(week_of DESC);

ALTER TABLE manager_weekly_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY manager_weekly_updates_own ON manager_weekly_updates
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
