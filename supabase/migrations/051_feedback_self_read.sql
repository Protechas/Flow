-- Employees can read their own Innovation Hub submissions. Without this,
-- the insert's RETURNING clause was rejected by RLS for non-manager roles,
-- which surfaced as "no permission" when submitting feedback.

DO $$ BEGIN
  CREATE POLICY feedback_select_own ON feedback_submissions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
