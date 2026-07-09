-- Coach nudges: each employee picks the attitude of their workspace coach.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS coach_persona TEXT NOT NULL DEFAULT 'professional';

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_coach_persona_check CHECK (
    coach_persona IN ('professional', 'encouraging', 'drill_sergeant', 'smartass')
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
