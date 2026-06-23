-- Team lead seat on teams (structure can exist before a person is assigned)

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS team_lead_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_team_lead ON teams(team_lead_user_id);

COMMENT ON COLUMN teams.team_lead_user_id IS 'Assigned team lead; nullable while seat is vacant';
