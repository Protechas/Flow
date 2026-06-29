export type ValidationEngineStatus = "active" | "planned" | "future";

export type ValidationEngineId =
  | "si_library_audit"
  | "si_library_external"
  | "id3_validation"
  | "oem_validation"
  | "document_validation";

export interface ValidationEngineDefinition {
  id: ValidationEngineId;
  label: string;
  description: string;
  status: ValidationEngineStatus;
  inputRoles: { role: string; label: string; required: boolean }[];
}

export type ValidationFindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ValidationRootCause =
  | "library_issue"
  | "oem_data_issue"
  | "import_issue"
  | "employee_error"
  | "missing_data"
  | "rule_mismatch"
  | "system_logic_issue"
  | "unknown"
  | "needs_investigation";

export const VALIDATION_ROOT_CAUSE_LABELS: Record<ValidationRootCause, string> = {
  library_issue: "Library Issue",
  oem_data_issue: "OEM Data Issue",
  import_issue: "Import Issue",
  employee_error: "Employee Error",
  missing_data: "Missing Data",
  rule_mismatch: "Rule Mismatch",
  system_logic_issue: "System Logic Issue",
  unknown: "Unknown",
  needs_investigation: "Needs Investigation",
};

export interface ValidationNavItem {
  href: string;
  label: string;
  description: string;
}

export type ValidationRunStatus = "pending" | "processing" | "completed" | "failed";
export type ValidationJobStatus = "pending" | "processing" | "completed" | "failed";

export type ValidationFileRole =
  | "manufacturer_chart"
  | "onedrive_export"
  | "output_workbook"
  | "output_pdf"
  | "external_report";

export interface ValidationRunSummary {
  engine_id: ValidationEngineId;
  manufacturer: string | null;
  compliance_rate: number | null;
  expected_deliverables: number | null;
  passing_compliance: number | null;
  needs_review: number | null;
  executive_summary: string | null;
  findings_preview?: unknown[];
}

export interface ValidationRun {
  id: string;
  engine_id: ValidationEngineId;
  status: ValidationRunStatus;
  manufacturer: string | null;
  title: string | null;
  compliance_rate: number | null;
  run_summary: ValidationRunSummary;
  settings_snapshot: Record<string, unknown>;
  error_message: string | null;
  prior_run_id: string | null;
  project_id: string | null;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationStoredFile {
  id: string;
  run_id: string;
  role: ValidationFileRole;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  file_data_base64?: string;
}

export interface ValidationJob {
  id: string;
  run_id: string;
  engine_id: ValidationEngineId;
  status: ValidationJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ValidationRunView extends ValidationRun {
  files: ValidationStoredFile[];
  job_status: ValidationJobStatus | null;
  findings_count: number;
}

export interface SiLibraryAuditSettings {
  filename_translation_rules: { from: string; to: string }[];
  split_file_patterns: string[];
  placeholder_mappings: { feature: string; filename: string }[];
  placeholder_filenames: Record<string, string>;
  model_aliases: Record<string, Record<string, string>>;
  compliance_threshold_excellent: number;
  compliance_threshold_acceptable: number;
  similarity_threshold: number;
}

export type ValidationFindingStatus =
  | "open"
  | "in_review"
  | "task_created"
  | "corrected"
  | "resolved"
  | "dismissed";

export interface ValidationFinding {
  id: string;
  validation_run_id: string;
  engine_id: ValidationEngineId;
  title: string;
  severity: ValidationFindingSeverity;
  status: ValidationFindingStatus;
  root_cause: ValidationRootCause;
  confidence_score: number;
  suggested_correction: string;
  manufacturer: string | null;
  match_status: string | null;
  affected_record_ref: Record<string, unknown>;
  evidence: Record<string, unknown>;
  work_item_id: string | null;
  qa_status: ValidationFindingQaStatus | null;
  resolution_date: string | null;
  prior_finding_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ValidationFindingQaStatus = "pending" | "pass" | "fail" | "n/a";

export interface ValidationFindingTaskBridge {
  id: string;
  validation_finding_id: string;
  work_item_id: string;
  batch_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ValidationCorrectionView extends ValidationFinding {
  task_title: string | null;
  task_status: string | null;
  task_qa_status: string | null;
  task_assignee_name: string | null;
}

export interface ValidationFindingFilters {
  q?: string;
  engine_id?: ValidationEngineId;
  validation_run_id?: string;
  severity?: ValidationFindingSeverity | "all";
  status?: ValidationFindingStatus | "all";
  root_cause?: ValidationRootCause | "all";
  manufacturer?: string;
}

export const VALIDATION_FINDING_STATUS_LABELS: Record<ValidationFindingStatus, string> = {
  open: "Open",
  in_review: "In Review",
  task_created: "Task Created",
  corrected: "Corrected",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const VALIDATION_SEVERITY_LABELS: Record<ValidationFindingSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const VALIDATION_QA_STATUS_LABELS: Record<
  NonNullable<ValidationFindingQaStatus>,
  string
> = {
  pending: "QA Pending",
  pass: "QA Pass",
  fail: "QA Fail",
  "n/a": "No QA",
};

export interface ValidationTrendPoint {
  date: string;
  complianceRate: number;
  manufacturer: string | null;
  runId: string;
}

export interface ValidationRootCauseStat {
  root_cause: ValidationRootCause;
  count: number;
}

export interface ValidationManufacturerStat {
  manufacturer: string;
  avgCompliance: number;
  runCount: number;
  openFindings: number;
}

export interface ValidationCenterKpis {
  libraryAccuracyPct: number | null;
  auditPassRate: number | null;
  openFindings: number;
  criticalFindingsOpen: number;
  correctionsInProgress: number;
  qaPending: number;
  resolvedFindings: number;
  repeatFindingsRate: number | null;
  revalidationImprovementPct: number | null;
  completedRuns: number;
  trendPoints: ValidationTrendPoint[];
  rootCauseBreakdown: ValidationRootCauseStat[];
  manufacturerAccuracy: ValidationManufacturerStat[];
}

export interface ValidationRunComparison {
  baseline: ValidationRunView;
  followUp: ValidationRunView;
  complianceDelta: number | null;
  improvementPct: number | null;
  baselineFindingsCount: number;
  followUpFindingsCount: number;
  resolvedCount: number;
  stillOpenCount: number;
  newIssuesCount: number;
  resolved: ValidationFinding[];
  stillOpen: ValidationFinding[];
  newIssues: ValidationFinding[];
}

export interface ProjectValidationMetrics {
  projectId: string;
  linkedRuns: number;
  lastRunDate: string | null;
  avgCompliance: number | null;
  openFindings: number;
  correctionsInProgress: number;
  qaPending: number;
  resolvedFindings: number;
}
