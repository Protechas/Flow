-- Employee pay type: hourly (shift clock) vs salary (task-based tracking)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pay_type TEXT NOT NULL DEFAULT 'hourly'
    CHECK (pay_type IN ('hourly', 'salary'));

UPDATE public.users
SET pay_type = 'salary'
WHERE role IN ('admin', 'manager', 'teamlead', 'viewer');

UPDATE public.users
SET pay_type = 'hourly'
WHERE role = 'employee' AND pay_type IS NULL;
