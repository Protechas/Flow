-- Enterprise reporting chain hierarchy (augments users.manager_id)
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hierarchy_level INTEGER NOT NULL DEFAULT 1,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_hierarchy_no_self CHECK (user_id <> parent_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_hierarchy_primary
  ON user_hierarchy(user_id) WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_hierarchy_parent ON user_hierarchy(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_user ON user_hierarchy(user_id);

-- Backfill primary hierarchy edges from existing manager_id
INSERT INTO user_hierarchy (user_id, parent_user_id, hierarchy_level, is_primary, is_active)
SELECT u.id, u.manager_id, 1, true, u.is_active
FROM users u
WHERE u.manager_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_hierarchy h
    WHERE h.user_id = u.id AND h.parent_user_id = u.manager_id AND h.is_primary = true
  );
