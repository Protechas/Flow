-- One-off tracked sessions (meetings, training) taken during a shift.
-- Starting one pauses the active task timer; ending it resumes work.
-- Every minute is attributed and visible to leads — that's the abuse guard.
CREATE TABLE IF NOT EXISTS side_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('meeting', 'training')),
  note TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  minutes INTEGER NOT NULL DEFAULT 0,
  -- Task timer this session paused, so ending the session can resume it.
  paused_task_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_side_sessions_user_started
  ON side_sessions(user_id, started_at DESC);

ALTER TABLE side_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY side_sessions_select ON side_sessions
  FOR SELECT TO authenticated
  USING (true);

-- Users record sessions for themselves only.
CREATE POLICY side_sessions_insert ON side_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY side_sessions_update ON side_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
