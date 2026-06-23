-- Extended user profile fields for admin user management
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'on_leave', 'terminated'));

COMMENT ON COLUMN public.users.phone IS 'Contact phone number';
COMMENT ON COLUMN public.users.job_title IS 'Display job title (may differ from org seat title)';
COMMENT ON COLUMN public.users.employment_status IS 'Employment lifecycle: active, on_leave, terminated';
