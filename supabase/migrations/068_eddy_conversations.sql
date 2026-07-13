-- Eddy Phase 1: persistent, strictly per-user conversations. Dusty's threads
-- never mix with Tara's — user_id is on every row and RLS enforces ownership
-- even below the app layer.
CREATE TABLE IF NOT EXISTS eddy_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eddy_conversations_user
  ON eddy_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS eddy_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES eddy_conversations(id) ON DELETE CASCADE,
  -- Denormalized owner so RLS applies directly to messages too.
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- Manual excerpts cited by the assistant turn, for the sources list.
  sources JSONB,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eddy_messages_conversation
  ON eddy_messages(conversation_id, created_at);

ALTER TABLE eddy_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE eddy_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY eddy_conversations_own ON eddy_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY eddy_messages_own ON eddy_messages
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
