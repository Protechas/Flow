-- RLS for org_positions: authenticated read, admins manage

ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_positions_select_authenticated ON public.org_positions;
CREATE POLICY org_positions_select_authenticated
  ON public.org_positions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS org_positions_insert_manage ON public.org_positions;
CREATE POLICY org_positions_insert_manage
  ON public.org_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS org_positions_update_manage ON public.org_positions;
CREATE POLICY org_positions_update_manage
  ON public.org_positions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS org_positions_delete_manage ON public.org_positions;
CREATE POLICY org_positions_delete_manage
  ON public.org_positions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_positions TO service_role;
