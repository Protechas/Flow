-- Not every team does production work: the Email Team answers help emails and
-- must not be ranked against doc-production metrics. Production surfaces
-- (performance, leaderboard, time-clock rosters) honor this flag.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS is_production BOOLEAN NOT NULL DEFAULT TRUE;
