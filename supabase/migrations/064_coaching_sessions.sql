-- Coaching sessions: the accountability record behind "I got onto her about
-- her time". Who coached whom, about what, what was agreed, whether the
-- employee acknowledged it, and whether the follow-up actually happened.
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('time_attendance', 'quality', 'conduct', 'performance', 'other')),
  level TEXT NOT NULL DEFAULT 'coaching' CHECK (level IN ('coaching', 'verbal_warning', 'written_warning', 'final_warning')),
  -- What happened and what was discussed.
  summary TEXT NOT NULL,
  -- What was agreed / expected going forward.
  expectation TEXT,
  follow_up_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  -- Employee confirmation that the conversation happened.
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_employee
  ON coaching_sessions(employee_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status
  ON coaching_sessions(status, follow_up_date);

ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Sensitive records: employees see their own; leadership reads run through
-- the app's service role with app-layer permission checks.
CREATE POLICY coaching_sessions_select_own ON coaching_sessions
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR coach_id = auth.uid());

CREATE POLICY coaching_sessions_insert ON coaching_sessions
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY coaching_sessions_update ON coaching_sessions
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR coach_id = auth.uid());
