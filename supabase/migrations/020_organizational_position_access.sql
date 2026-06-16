-- Separate org chart position from system access level (legacy role column retained)

DO $$ BEGIN
  CREATE TYPE organizational_position AS ENUM (
    'employee',
    'team_lead',
    'manager',
    'senior_manager'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE system_access_level AS ENUM ('standard', 'admin', 'super_admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organizational_position organizational_position,
  ADD COLUMN IF NOT EXISTS system_access_level system_access_level;

UPDATE users
SET organizational_position = 'employee', system_access_level = 'standard'
WHERE organizational_position IS NULL AND role IN ('employee', 'viewer');

UPDATE users
SET organizational_position = 'team_lead', system_access_level = 'standard'
WHERE organizational_position IS NULL AND role = 'teamlead';

UPDATE users
SET organizational_position = 'manager', system_access_level = 'standard'
WHERE organizational_position IS NULL AND role = 'manager';

UPDATE users
SET organizational_position = 'senior_manager', system_access_level = 'standard'
WHERE organizational_position IS NULL AND role = 'senior_manager';

UPDATE users
SET organizational_position = 'manager', system_access_level = 'admin'
WHERE organizational_position IS NULL AND role = 'admin';

UPDATE users
SET organizational_position = 'senior_manager', system_access_level = 'super_admin'
WHERE organizational_position IS NULL AND role = 'super_admin';

UPDATE users
SET organizational_position = COALESCE(organizational_position, 'employee'),
    system_access_level = COALESCE(system_access_level, 'standard')
WHERE organizational_position IS NULL OR system_access_level IS NULL;

ALTER TABLE users
  ALTER COLUMN organizational_position SET DEFAULT 'employee',
  ALTER COLUMN system_access_level SET DEFAULT 'standard';
