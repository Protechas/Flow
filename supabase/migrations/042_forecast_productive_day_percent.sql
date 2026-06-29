-- Productive day capacity as percent (flexible schedules) instead of raw hours only
ALTER TABLE forecast_settings
  ADD COLUMN IF NOT EXISTS productive_day_percent NUMERIC(5,2);

UPDATE forecast_settings
SET productive_day_percent = ROUND((productive_hours_per_day / 8.0) * 100, 2)
WHERE productive_day_percent IS NULL;

UPDATE forecast_settings
SET productive_day_percent = 81.25
WHERE productive_day_percent IS NULL;

ALTER TABLE forecast_settings
  ALTER COLUMN productive_day_percent SET DEFAULT 81.25;

COMMENT ON COLUMN forecast_settings.productive_day_percent IS
  'Percent of an 8h reference workday used for forecast capacity (flexible schedules).';
