-- Enterprise permission layer (Phase 1) — optional user overrides on top of role-based RBAC.
-- When no rows exist for a user, the app falls back to existing ROLE_PERMISSIONS behavior.

CREATE TABLE IF NOT EXISTS user_permission_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL DEFAULT 'employee',
  is_customized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_profiles_template_check CHECK (
    template_id IN ('employee', 'manager', 'team_lead', 'senior_manager', 'admin', 'super_admin')
  )
);

CREATE TABLE IF NOT EXISTS user_permission_modules (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'visible',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_id),
  CONSTRAINT user_permission_modules_visibility_check CHECK (visibility IN ('visible', 'hidden'))
);

CREATE INDEX IF NOT EXISTS idx_user_permission_modules_user ON user_permission_modules(user_id);

ALTER TABLE user_permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_modules ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_modules TO service_role;

DO $$ BEGIN
  CREATE POLICY user_permission_profiles_admin ON user_permission_profiles
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY user_permission_modules_admin ON user_permission_modules
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY user_permission_profiles_self_read ON user_permission_profiles
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY user_permission_modules_self_read ON user_permission_modules
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Reload PostgREST schema cache so Supabase API sees new tables immediately
NOTIFY pgrst, 'reload schema';
