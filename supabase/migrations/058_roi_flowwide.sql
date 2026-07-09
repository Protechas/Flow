-- Flow-wide ROI: workflow + subscription assumptions join the engine ones.

ALTER TABLE roi_settings
  ADD COLUMN IF NOT EXISTS monday_seat_cost NUMERIC NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS timesheet_minutes_per_day NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS wrapup_minutes_saved NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS clock_correction_minutes NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS submission_routing_minutes NUMERIC NOT NULL DEFAULT 10;
