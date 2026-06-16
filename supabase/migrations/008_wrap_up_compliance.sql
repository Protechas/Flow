-- Daily wrap-up submissions (employee end-of-day form)
CREATE TABLE IF NOT EXISTS daily_wrap_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wrap_date DATE NOT NULL,
  completed_summary TEXT,
  blockers TEXT,
  needs_support BOOLEAN NOT NULL DEFAULT false,
  needs_support_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, wrap_date)
);

-- Manager override when wrap-up not submitted before clock-out
CREATE TABLE IF NOT EXISTS daily_wrap_up_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wrap_date DATE NOT NULL,
  reason TEXT NOT NULL,
  overridden_by UUID NOT NULL REFERENCES users(id),
  overridden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, wrap_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_wrap_ups_date ON daily_wrap_ups (wrap_date);
CREATE INDEX IF NOT EXISTS idx_daily_wrap_up_overrides_date ON daily_wrap_up_overrides (wrap_date);
