-- Complete Validation Center RLS policies omitted from earlier migrations.

CREATE POLICY validation_findings_delete ON validation_findings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'teamlead')
    )
  );

CREATE POLICY validation_settings_insert ON validation_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY validation_files_update ON validation_files
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY validation_files_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'validation-files')
  WITH CHECK (bucket_id = 'validation-files');
