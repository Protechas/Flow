-- Flow sample seed data (run after migration, with auth users created separately)
-- For local demo, the app uses mock data in src/lib/data/mock-data.ts

-- Sample team
INSERT INTO teams (id, name, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Analyst Operations', 'Primary analyst team');

-- Note: users require auth.users entries in production.
-- Example structure for reference:
/*
INSERT INTO users (id, email, full_name, role, team_id) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'admin@flow.local', 'Alex Admin', 'admin', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'manager@flow.local', 'Morgan Manager', 'manager', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'qa@flow.local', 'Quinn QA', 'qa', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000004', 'analyst1@flow.local', 'Jordan Analyst', 'analyst', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000005', 'analyst2@flow.local', 'Taylor Analyst', 'analyst', 'a0000000-0000-4000-8000-000000000001');
*/
