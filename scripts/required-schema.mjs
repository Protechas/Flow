/** Schema objects Flow requires after all migrations are applied. */
export const REQUIRED_TABLES = [
  "users",
  "teams",
  "departments",
  "department_users",
  "projects",
  "work_items",
  "time_clock_entries",
  "task_time_entries",
  "task_file_uploads",
  "task_submission_records",
  "qa_review_records",
  "daily_wrap_ups",
  "daily_wrap_up_overrides",
  "audit_log",
  "forecast_settings",
  "help_flags",
  "workload_alerts",
  "org_positions",
  "notifications",
  "year_work_items",
  "work_visibility_settings",
  "project_intelligence_snapshots",
  "validation_runs",
  "validation_findings",
  "user_permission_profiles",
  "user_permission_modules",
  "qa_knowledge_entries",
  "qa_knowledge_versions",
  "qa_knowledge_index",
  "qa_validation_rules",
  "qa_document_validations",
  "qa_gold_standards",
];

export const REQUIRED_COLUMNS = [
  {
    label: "users.assigned_position_id",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='users' AND column_name='assigned_position_id'`,
  },
  {
    label: "users.pay_type",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='users' AND column_name='pay_type'`,
  },
  {
    label: "time_clock_entries.id is uuid",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='time_clock_entries'
            AND column_name='id' AND udt_name='uuid'`,
  },
  {
    label: "task_time_entries.id is uuid",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='task_time_entries'
            AND column_name='id' AND udt_name='uuid'`,
  },
  {
    label: "time_clock_entries.department_id",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='time_clock_entries' AND column_name='department_id'`,
  },
  {
    label: "task_time_entries.department_id",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='task_time_entries' AND column_name='department_id'`,
  },
  {
    label: "projects.structure_mode",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='projects' AND column_name='structure_mode'`,
  },
  {
    label: "projects.productive_day_percent",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='projects' AND column_name='productive_day_percent'`,
  },
];
