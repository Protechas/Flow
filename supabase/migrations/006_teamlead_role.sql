-- Rename QA role to teamlead for team lead supervisors
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teamlead';
