-- Wrap-up leader review metadata
ALTER TABLE daily_wrap_ups
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_daily_wrap_ups_reviewed ON daily_wrap_ups(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_daily_wrap_ups_follow_up ON daily_wrap_ups(follow_up_needed) WHERE follow_up_needed = true;
