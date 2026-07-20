-- Eddy Phase 2, tool #1: a personal to-do list per user, kept conversationally
-- through Ask Eddy ("add X to my list") or by hand in the To-Do panel.
-- Strictly per-user, same ownership contract as eddy_conversations.
CREATE TABLE IF NOT EXISTS user_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Context Eddy captured with the item ("from the Kia call — waiting on Mark").
  context TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'eddy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_todos_owner
  ON user_todos(user_id, status, sort_order);

ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_todos_own ON user_todos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
