-- Monday.com era baseline for the Then vs Now report. Weekly per-person
-- aggregates computed offline from the account export — a few hundred rows,
-- never raw items. Completely separate from live tables: no live engine
-- (scorecards, forecasts, coaching) reads this, and dropping the table
-- removes every trace of the import.
CREATE TABLE IF NOT EXISTS legacy_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'monday',
  person_name TEXT NOT NULL,
  -- Monday of the ISO week the items were completed in; NULL = undated items.
  week_start DATE,
  category TEXT NOT NULL,
  items_done INTEGER NOT NULL DEFAULT 0,
  -- Sum of sanity-capped per-item clocks (5s..4h); 0 = board had no clock.
  clock_seconds BIGINT NOT NULL DEFAULT 0,
  items_with_clock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_metrics_week
  ON legacy_metrics(source, week_start);

ALTER TABLE legacy_metrics ENABLE ROW LEVEL SECURITY;

-- Read-only report data: reads run through the app's service role with
-- app-layer permission checks; no direct client access needed.
