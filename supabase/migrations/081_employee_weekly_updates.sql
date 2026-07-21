-- Employee weekly updates (team-workspace engine; first tenant: Advanced
-- Projects). One row per employee per week, auto-drafted from daily wrap-ups,
-- submitted inside the team's window. Comments/reactions live in a child
-- table. Server-side (service role) reads/writes only.
CREATE TABLE IF NOT EXISTS employee_weekly_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- The Friday (org timezone) of the week this update covers.
  week_of DATE NOT NULL,
  sections JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'reassigned')),
  -- Prior submitted versions: [{sections, submitted_at}, …] oldest first.
  revisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reassigned_by UUID REFERENCES users(id),
  reassigned_note TEXT,
  UNIQUE (user_id, week_of)
);

CREATE INDEX IF NOT EXISTS idx_employee_weekly_updates_week
  ON employee_weekly_updates(week_of DESC);

CREATE TABLE IF NOT EXISTS weekly_update_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES employee_weekly_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'comment' carries body text; 'reaction' carries an emoji.
  kind TEXT NOT NULL CHECK (kind IN ('comment', 'reaction')),
  body TEXT,
  emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_update_comments_update
  ON weekly_update_comments(update_id, created_at);

ALTER TABLE employee_weekly_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_update_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_weekly_updates_own ON employee_weekly_updates
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY weekly_update_comments_own ON weekly_update_comments
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
