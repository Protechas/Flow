-- Self-service signups always create basic employee accounts (admin assigns team/role later).

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

  IF COALESCE(NEW.raw_user_meta_data->>'signup_type', '') = 'self' THEN
    v_role := 'employee'::user_role;
  ELSE
    BEGIN
      v_role := COALESCE(
        (NEW.raw_user_meta_data->>'role')::user_role,
        'employee'::user_role
      );
    EXCEPTION WHEN OTHERS THEN
      v_role := 'employee'::user_role;
    END;
  END IF;

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
    role = CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'signup_type', '') = 'self' THEN public.users.role
      ELSE COALESCE(EXCLUDED.role, public.users.role)
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;
