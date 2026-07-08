-- Registers the off-site audit worker so it can heartbeat into
-- validation_settings (engine_id has a FK to validation_engines).

INSERT INTO validation_engines (id, label, description, status)
VALUES (
  'audit_worker',
  'Audit Worker',
  'Heartbeat entry for the machine that executes Python audit jobs',
  'active'
)
ON CONFLICT (id) DO NOTHING;
