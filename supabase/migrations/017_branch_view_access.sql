-- Allow admins to grant managers full branch visibility beyond their own teams
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_view_access BOOLEAN NOT NULL DEFAULT false;
