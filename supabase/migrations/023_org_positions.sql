-- Position-based org chart: seats separate from users

DO $$ BEGIN
  CREATE TYPE org_position_status AS ENUM ('filled', 'vacant', 'planned', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS org_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  reports_to_position_id UUID REFERENCES org_positions(id) ON DELETE SET NULL,
  position_level organizational_position NOT NULL DEFAULT 'employee',
  position_type TEXT DEFAULT 'standard',
  status org_position_status NOT NULL DEFAULT 'vacant',
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_positions_assigned_user_unique UNIQUE (assigned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_positions_reports_to ON org_positions(reports_to_position_id);
CREATE INDEX IF NOT EXISTS idx_org_positions_department ON org_positions(department_id);
CREATE INDEX IF NOT EXISTS idx_org_positions_team ON org_positions(team_id);
CREATE INDEX IF NOT EXISTS idx_org_positions_status ON org_positions(status);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_position_id UUID REFERENCES org_positions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_assigned_position ON users(assigned_position_id);

COMMENT ON TABLE org_positions IS 'Organizational seats — structure exists independent of assigned users';
COMMENT ON COLUMN users.assigned_position_id IS 'Primary org seat for this user; reporting chain derived from position hierarchy';
