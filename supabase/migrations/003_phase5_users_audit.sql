-- Phase 5: extended user profile fields + audit log

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Backfill names from full_name
UPDATE public.users
SET
  first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
  last_name = COALESCE(
    last_name,
    NULLIF(trim(substring(full_name from position(' ' in full_name) + 1)), '')
  )
WHERE full_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;
CREATE POLICY "Authenticated insert audit"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sync extended fields on auth user create
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_first TEXT;
  v_last TEXT;
  v_full TEXT;
BEGIN
  v_first := COALESCE(NEW.raw_user_meta_data->>'first_name', NULL);
  v_last := COALESCE(NEW.raw_user_meta_data->>'last_name', NULL);
  v_full := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    trim(concat_ws(' ', v_first, v_last)),
    split_part(NEW.email, '@', 1)
  );
  IF v_first IS NULL THEN
    v_first := split_part(v_full, ' ', 1);
  END IF;
  IF v_last IS NULL OR v_last = '' THEN
    v_last := NULLIF(trim(substring(v_full from position(' ' in v_full) + 1)), '');
  END IF;

  BEGIN
    v_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'employee'::user_role
    );
  EXCEPTION WHEN OTHERS THEN
    v_role := 'employee'::user_role;
  END;

  INSERT INTO public.users (
    id, email, full_name, first_name, last_name, role, team_id, manager_id, is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full,
    v_first,
    v_last,
    v_role,
    (NEW.raw_user_meta_data->>'team_id')::UUID,
    (NEW.raw_user_meta_data->>'manager_id')::UUID,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    role = COALESCE(EXCLUDED.role, public.users.role),
    updated_at = NOW();

  RETURN NEW;
END;
$$;
