-- ROI assumptions: how much manual time each automated operation replaces.
-- Single-row settings table, editable from the Library Intelligence page.

CREATE TABLE IF NOT EXISTS roi_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  labor_rate NUMERIC NOT NULL DEFAULT 35,
  manual_audit_hours NUMERIC NOT NULL DEFAULT 6,
  manual_validation_hours NUMERIC NOT NULL DEFAULT 3,
  manual_scan_hours NUMERIC NOT NULL DEFAULT 2,
  batch_review_minutes_saved NUMERIC NOT NULL DEFAULT 15,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO roi_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
ALTER TABLE roi_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.roi_settings TO service_role;
