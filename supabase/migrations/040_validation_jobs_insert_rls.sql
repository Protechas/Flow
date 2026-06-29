-- validation_jobs had SELECT/UPDATE policies but no INSERT policy (RLS blocked job creation).

CREATE POLICY validation_jobs_insert ON validation_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );
