-- Request routing: which team(s) receive submitted tickets. One row.
-- Empty array = derive from org structure (departments with active projects).
CREATE TABLE IF NOT EXISTS request_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  receiving_team_ids UUID[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO request_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE request_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY request_settings_select ON request_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY request_settings_update ON request_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );
