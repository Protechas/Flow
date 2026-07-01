-- RLS for remaining QA Center tables (document validations, rules, gold standards)

ALTER TABLE qa_document_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_gold_standards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY qa_document_validations_select ON qa_document_validations
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_document_validations_insert ON qa_document_validations
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager', 'analyst', 'qa')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_document_validations_update ON qa_document_validations
    FOR UPDATE TO authenticated
    USING (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    )
    WITH CHECK (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_validation_rules_select ON qa_validation_rules
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_validation_rules_mutate ON qa_validation_rules
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_gold_standards_select ON qa_gold_standards
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY qa_gold_standards_mutate ON qa_gold_standards
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'super_admin', 'senior_manager', 'manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
