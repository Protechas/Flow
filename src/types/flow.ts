export type UserRole =
  | "super_admin"
  | "admin"
  | "senior_manager"
  | "manager"
  | "teamlead"
  | "employee"
  | "viewer";

/** Where someone appears in the org chart and reporting chain */
export type OrganizationalPosition =
  | "employee"
  | "team_lead"
  | "manager"
  | "senior_manager";

/** Elevated system tools — independent of org chart position */
export type SystemAccessLevel = "standard" | "admin" | "super_admin";

/** Future roles — extend permissions when activated */
export type FutureUserRole =
  | "qa_lead"
  | "trainer"
  | "auditor"
  | "department_coordinator";

export type HierarchyLevel = 1 | 2 | 3 | 4 | 5;

export interface UserHierarchyRecord {
  id: string;
  user_id: string;
  parent_user_id: string;
  hierarchy_level: HierarchyLevel;
  department_id?: string | null;
  team_id?: string | null;
  is_active: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

/** Org chart seat — independent of assigned user */
export type OrgPositionStatus = "filled" | "vacant" | "planned" | "inactive";

export interface OrgPosition {
  id: string;
  title: string;
  department_id?: string | null;
  team_id?: string | null;
  reports_to_position_id?: string | null;
  position_level: OrganizationalPosition;
  position_type?: string | null;
  status: OrgPositionStatus;
  assigned_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgPositionInput {
  title: string;
  department_id?: string | null;
  team_id?: string | null;
  reports_to_position_id?: string | null;
  position_level: OrganizationalPosition;
  position_type?: string | null;
  status?: OrgPositionStatus;
  assigned_user_id?: string | null;
}

export interface OrgChartNode {
  /** Assigned user when filled; null for vacant/planned seats */
  user: User | null;
  /** Present when org chart is position-based */
  position?: OrgPosition | null;
  children: OrgChartNode[];
  department_name?: string | null;
  team_name?: string | null;
}

export type OrgChartStatusFlag =
  | "active"
  | "inactive"
  | "clocked_in"
  | "clocked_out"
  | "needs_work"
  | "needs_help"
  | "missing_wrap_up";

export interface OrgChartUserOps {
  userId: string;
  flags: OrgChartStatusFlag[];
  clockLabel?: string;
  clockStatus?: "in" | "out" | "na";
  activeTaskTitle?: string | null;
  remainingHours?: number | null;
  openHelpCount: number;
  helpFlagStatus?: string | null;
  workloadStatus?: string | null;
  wrapUpStatus?: WrapUpComplianceStatus;
  flowScore?: number | null;
  engagementLevel?: "high" | "medium" | "low" | null;
  tasksCompleted?: number;
}

export interface OrgChartActiveTask {
  id: string;
  title: string;
  status: WorkStatus;
}

export interface OrgChartProfileDetail {
  userId: string;
  departmentName: string;
  teamName: string;
  reportsTo: { id: string; name: string; role: UserRole } | null;
  directReports: { id: string; name: string; role: UserRole }[];
  reportingChain: ReportingChainEntry[];
  activeTasks: OrgChartActiveTask[];
  ops: OrgChartUserOps;
  helpFlags: {
    id: string;
    reason: string;
    status: string;
    notes?: string | null;
    created_at: string;
  }[];
  workloadSummary: string | null;
}

export interface OrgChartViewerPermissions {
  canViewProfile: boolean;
  canAssignTask: boolean;
  canViewWorkload: boolean;
  canViewWrapUps: boolean;
  canViewHelpFlags: boolean;
  canViewTimeclock: boolean;
  canEditReportingChain: boolean;
  canManagePositions: boolean;
  canAssignPositions: boolean;
}

export interface UnassignedUserRow {
  user: User;
  departmentName: string | null;
  suggestedPositionId: string | null;
  suggestedPositionTitle: string | null;
}

export interface ReportingChainEntry {
  user_id: string;
  full_name: string;
  role: UserRole;
  relationship: "direct_supervisor" | "manager" | "senior_manager" | "admin";
}

export type PayType = "hourly" | "salary";

export type WorkStatus =
  | "not_started"
  | "assigned"
  | "working_on_it"
  | "waiting"
  | "ready_for_qa"
  | "in_qa"
  | "correction_needed"
  | "stuck"
  | "done";

export type WorkPriority = "low" | "medium" | "high" | "urgent";

/** Document-volume complexity tier for due-date forecasting */
export type ForecastComplexityLevel = "simple" | "standard" | "complex" | "very_complex";

/** Forecast vs committed due date alignment */
export type DueDateStatus =
  | "on_track"
  | "at_risk"
  | "behind_capacity"
  | "needs_review"
  | "no_forecast";

/** Planning vs live production forecasting */
export type ForecastMode = "planning" | "active";

/** Task-level live forecast lifecycle badge */
export type LiveForecastStatus =
  | "assigned"
  | "forecast_pending"
  | "planning_forecast"
  | "active_forecast"
  | "on_track"
  | "at_risk"
  | "behind_forecast"
  | "completed";

/** Scope for future production-rate overrides (v1 uses company defaults) */
export type ForecastRateScope = "company" | "department" | "employee";

export const FORECAST_COMPLEXITY_MULTIPLIERS: Record<ForecastComplexityLevel, number> = {
  simple: 0.8,
  standard: 1,
  complex: 1.3,
  very_complex: 1.5,
};

export interface ForecastSettings {
  id: string;
  minutes_per_document: number;
  /** Percent of a nominal 8h workday available for production (flexible schedules). */
  productive_day_percent: number;
  /** Derived from productive_day_percent — used internally for forecast math. */
  productive_hours_per_day: number;
  /** 0=Sunday … 6=Saturday */
  working_days: number[];
  updated_at: string;
  updated_by?: string | null;
}

export interface TaskForecastInput {
  estimated_document_count?: number | null;
  complexity_level?: ForecastComplexityLevel | null;
  estimated_minutes_per_document?: number | null;
  start_date?: string | null;
  manual_due_date?: string | null;
  due_date?: string | null;
  status?: WorkStatus;
}

export interface TaskForecastResult {
  complexity_level: ForecastComplexityLevel;
  complexity_multiplier: number;
  estimated_minutes_per_document: number;
  estimated_work_minutes: number | null;
  estimated_work_hours: number | null;
  estimated_work_days: number | null;
  suggested_due_date: string | null;
  due_date_status: DueDateStatus;
  forecast_last_calculated: string;
}

export interface ProjectForecastRollup {
  estimated_total_documents: number | null;
  estimated_total_hours: number | null;
  estimated_total_work_days: number | null;
  suggested_project_due_date: string | null;
  planning_project_due_date: string | null;
  active_project_due_date: string | null;
  project_due_date_status: DueDateStatus;
  forecast_confidence: number;
}

export interface ForecastDashboardStats {
  projectsAtRisk: number;
  tasksAtRisk: number;
  missingEstimates: number;
  upcomingDueDates: number;
  behindCapacity: number;
  needsReview: number;
  tasksWaitingToStart: number;
  activeForecasts: number;
  tasksBehindForecast: number;
  projectsBehindForecast: number;
  departmentLoad: { departmentId: string; departmentName: string; activeTasks: number; estimatedHours: number }[];
}

export interface ForecastReportMetrics {
  totalEstimatedDocuments: number;
  totalEstimatedHours: number;
  totalEstimatedWorkDays: number;
  tasksMissingEstimates: number;
  projectsMissingEstimates: number;
  tasksAtRisk: number;
  projectsAtRisk: number;
  tasksOnTrack: number;
  forecastVarianceAvgDays: number;
  byDepartment: {
    departmentId: string;
    departmentName: string;
    estimatedHours: number;
    activeTasks: number;
    atRisk: number;
  }[];
  atRiskTasks: { id: string; title: string; employeeName: string; suggestedDueDate: string | null; manualDueDate: string | null; status: DueDateStatus }[];
  atRiskProjects: { id: string; name: string; suggestedDueDate: string | null; manualDueDate: string | null; status: DueDateStatus }[];
  planningVsActiveVarianceAvgDays: number;
  activeForecastCount: number;
  tasksBehindActiveForecast: number;
}

export type QaStatus =
  | "pending"
  | "passed"
  | "minor_correction"
  | "major_correction"
  | "rejected";

export type QaResult =
  | "pass"
  | "minor_correction"
  | "major_correction"
  | "rejected";

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  lead_user_id?: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export type DepartmentRoleInDepartment = "member" | "lead" | "manager";

export interface DepartmentUser {
  id: string;
  department_id: string;
  user_id: string;
  role_in_department: DepartmentRoleInDepartment;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  /** False for support teams (e.g. Email Team) that are excluded from production metrics. */
  is_production?: boolean;
  department_id?: string | null;
  manager_id?: string | null;
  team_lead_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type EmploymentStatus = "active" | "on_leave" | "terminated";

export type AuditAction =
  | "user_created"
  | "user_invited"
  | "user_deleted"
  | "user_disabled"
  | "user_reactivated"
  | "role_changed"
  | "team_changed"
  | "assignment_changed"
  | "project_changed"
  | "qa_decision"
  | "password_reset"
  | "status_changed"
  | "email_changed"
  | "user_profile_updated"
  | "workflow_alert";

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  organizational_position?: OrganizationalPosition | null;
  system_access_level?: SystemAccessLevel | null;
  pay_type?: PayType | null;
  /** Workspace coach attitude: professional | encouraging | drill_sergeant | smartass */
  coach_persona?: string | null;
  /** Cosmetic unlocks earned via badges */
  avatar_frame?: string | null;
  flair_title?: string | null;
  accent_color?: string | null;
  team_id?: string | null;
  manager_id?: string | null;
  assigned_position_id?: string | null;
  branch_view_access?: boolean | null;
  phone?: string | null;
  job_title?: string | null;
  employment_status?: EmploymentStatus | null;
  avatar_url?: string | null;
  hire_date?: string | null;
  last_login_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  project_type: string;
  /** How work is organized in the UI — drives smart labels alongside project_type. */
  structure_mode?: string | null;
  department_id?: string | null;
  team_id?: string | null;
  is_cross_department?: boolean;
  status: string;
  priority: WorkPriority;
  /**
   * The project's counting unit (files, lines, records…). Tasks inherit it
   * unless they set their own forecast_unit; every surface renders from it.
   * Null = team operating model default, then "files".
   */
  forecast_unit?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  end_date?: string | null;
  project_owner_id?: string | null;
  created_by?: string | null;
  estimated_total_documents?: number | null;
  estimated_total_hours?: number | null;
  estimated_total_work_days?: number | null;
  suggested_project_due_date?: string | null;
  manual_project_due_date?: string | null;
  planning_project_due_date?: string | null;
  active_project_due_date?: string | null;
  project_due_date_status?: DueDateStatus | null;
  forecast_confidence?: number | null;
  /** Complexity used for project-level planning before task estimates exist */
  planning_complexity_level?: ForecastComplexityLevel | null;
  created_at: string;
  updated_at: string;
}

export interface Manufacturer {
  id: string;
  project_id: string;
  name: string;
  code?: string | null;
  assigned_to?: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  due_date?: string | null;
  notes?: string | null;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

/** Year row: Project → Manufacturer → Year Work Item → Work Packages */
export interface YearWorkItem {
  id: string;
  project_id: string;
  manufacturer_id: string;
  year: number;
  assigned_to?: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  due_date?: string | null;
  estimated_hours: number;
  actual_hours: number;
  file_count: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkPackage {
  id: string;
  project_id: string;
  manufacturer_id: string;
  year_work_item_id: string;
  year: number;
  department_id?: string | null;
  title: string;
  notes?: string | null;
  description?: string | null;
  assigned_to?: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  due_date?: string | null;
  start_date?: string | null;
  completed_date?: string | null;
  estimated_hours: number;
  actual_hours: number;
  estimated_document_count?: number | null;
  /** What a "unit" of this task is: files (default), lines, VINs, ROs, batches… Label only — the math is count × minutes-per-unit. */
  forecast_unit?: string | null;
  complexity_level?: ForecastComplexityLevel | null;
  complexity_multiplier?: number | null;
  estimated_minutes_per_document?: number | null;
  estimated_work_minutes?: number | null;
  estimated_work_hours?: number | null;
  estimated_work_days?: number | null;
  suggested_due_date?: string | null;
  manual_due_date?: string | null;
  due_date_status?: DueDateStatus | null;
  forecast_last_calculated?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  forecast_mode?: ForecastMode | null;
  planning_due_date?: string | null;
  active_due_date?: string | null;
  forecast_start_date?: string | null;
  completed_at?: string | null;
  estimated_remaining_documents?: number | null;
  current_documents_completed?: number | null;
  current_production_rate?: number | null;
  forecast_last_updated?: string | null;
  live_forecast_status?: LiveForecastStatus | null;
  forecast_variance_days?: number | null;
  file_count: number;
  qa_status: QaStatus;
  correction_count: number;
  qa_required?: boolean;
  files_required?: boolean;
  created_at: string;
  updated_at: string;
  project?: Project;
  manufacturer?: Manufacturer;
  assignee?: User;
}

/** @deprecated Use WorkPackage */
export type WorkItem = WorkPackage;

export interface TimeLog {
  id: string;
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
  notes?: string | null;
  created_at: string;
}

export type TimeClockStatus = "active" | "completed" | "edited";

export type TimeClockOutType = "lunch" | "out";

export interface TimeClockEntry {
  id: string;
  user_id: string;
  department_id?: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  total_minutes: number | null;
  clock_out_type: TimeClockOutType | null;
  status: TimeClockStatus;
  edited_by: string | null;
  edit_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskTimeEntryStatus = "active" | "paused" | "completed";

export interface TaskTimePauseEvent {
  paused_at: string;
  resumed_at: string | null;
}

export interface TaskTimeEntry {
  id: string;
  user_id: string;
  task_id: string;
  department_id?: string | null;
  project_id: string;
  manufacturer_id: string;
  year_work_item_id: string;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  total_active_minutes: number;
  pause_events: TaskTimePauseEvent[];
  status: TaskTimeEntryStatus;
  is_correction_session: boolean;
  created_at: string;
  updated_at: string;
}

export type CoachingCategory =
  | "time_attendance"
  | "quality"
  | "conduct"
  | "performance"
  | "other";

export type CoachingLevel =
  | "coaching"
  | "verbal_warning"
  | "written_warning"
  | "final_warning";

/**
 * One coaching conversation, recorded for accountability: what happened,
 * what was agreed, whether the employee acknowledged it, and the follow-up.
 */
export interface CoachingSession {
  id: string;
  employee_id: string;
  coach_id: string;
  session_date: string;
  category: CoachingCategory;
  level: CoachingLevel;
  summary: string;
  expectation: string | null;
  follow_up_date: string | null;
  status: "open" | "resolved";
  resolved_at: string | null;
  resolution_note: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingSessionView extends CoachingSession {
  employee_name: string;
  coach_name: string;
}

export type RequestTicketStatus = "open" | "claimed" | "done" | "canceled";
export type RequestTicketPriority = "low" | "normal" | "urgent";

/**
 * A lightweight cross-team request ("I need a doc for X"). Submitted by anyone,
 * claimed first-come by the receiving team, tracked to done. Can be escalated
 * into a real work package (linked_task_id) when it turns out to be big.
 */
export interface RequestTicket {
  id: string;
  title: string;
  details: string | null;
  priority: RequestTicketPriority;
  requested_by: string;
  status: RequestTicketStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  linked_task_id: string | null;
  /** Task timer the claim paused — resumed when the ticket closes. */
  paused_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestTicketView extends RequestTicket {
  requested_by_name: string;
  claimed_by_name: string | null;
}

/** A file attached to a request ticket — how the deliverable changes hands. */
export interface RequestTicketFile {
  id: string;
  ticket_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
  /** Demo-mode only: file bytes kept in memory. */
  file_data_base64?: string;
}

export interface RequestTicketFileView extends RequestTicketFile {
  uploaded_by_name: string;
}

export type SideSessionCategory = "meeting" | "training";

/**
 * A tracked one-off during a shift (meeting, training). Starting one pauses
 * the active task timer; ending it resumes work. Fully attributed time.
 */
export interface SideSession {
  id: string;
  user_id: string;
  category: SideSessionCategory;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  minutes: number;
  /** Task timer this session paused — resumed when the session ends. */
  paused_task_id: string | null;
  status: "active" | "completed";
  created_at: string;
  updated_at: string;
}

export interface TaskFileUpload {
  id: string;
  task_id: string;
  project_id: string;
  department_id?: string | null;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url_or_path: string;
  storage_path?: string | null;
  file_data_base64?: string;
  /** SHA-256 of the file bytes — duplicate detection that renames can't beat. */
  content_hash?: string | null;
  uploaded_at: string;
  created_at: string;
}

export type TaskSubmissionStatus =
  | "submitted"
  | "in_review"
  | "approved"
  | "correction_requested"
  | "rejected"
  /** Analyst kept working after this submission (pre-fix limbo) — no review expected. */
  | "superseded";

/** final = whole-task handoff (locks the task for QA); batch = in-progress file batch, task stays workable. */
export type TaskSubmissionType = "final" | "batch";

export interface TaskSubmissionRecord {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  submitted_at: string;
  uploaded_file_count: number;
  total_task_minutes: number;
  average_minutes_per_document: number;
  documents_per_hour: number;
  original_task_minutes: number;
  correction_task_minutes: number;
  status: TaskSubmissionStatus;
  submission_type: TaskSubmissionType;
  file_ids: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QaReviewRecord {
  id: string;
  task_id: string;
  submission_id: string | null;
  reviewer_id: string;
  reviewed_at: string;
  status: QaResult;
  notes: string | null;
  correction_required: boolean;
  correction_reason: string | null;
  created_at: string;
}

export interface ProductionMetrics {
  totalTaskMinutes: number;
  uploadedFileCount: number;
  averageMinutesPerDocument: number;
  documentsPerHour: number;
  productivityRate: number;
}

export interface ProductionReportFilters {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  userId?: string;
  userIds?: string[];
  projectId?: string;
  manufacturerId?: string;
  status?: TaskSubmissionStatus | WorkStatus;
}

export interface ProductionReportRow {
  taskId: string;
  taskTitle: string;
  projectName: string;
  manufacturerName: string;
  employeeName: string;
  employeeId: string;
  submittedAt: string | null;
  totalTaskMinutes: number;
  fileCount: number;
  averageMinutesPerDocument: number;
  documentsPerHour: number;
  status: string;
  awaitingQa: boolean;
}

export interface ProductionReportSummary {
  totalSubmissions: number;
  awaitingQa: number;
  avgMinutesPerDocument: number;
  avgDocumentsPerHour: number;
  totalTaskHours: number;
  rows: ProductionReportRow[];
  byEmployee: { userId: string; name: string; submissions: number; totalMinutes: number; fileCount: number; docsPerHour: number }[];
  byDepartment: { departmentId: string; name: string; submissions: number; totalMinutes: number; fileCount: number; hoursWorked: number }[];
  byProject: { projectId: string; name: string; submissions: number; totalMinutes: number; fileCount: number }[];
  byManufacturer: { manufacturerId: string; name: string; submissions: number; totalMinutes: number; fileCount: number }[];
  trends: { date: string; submissions: number; avgDocsPerHour: number; totalMinutes: number }[];
}

export interface QaReview {
  id: string;
  work_package_id: string;
  reviewer_id: string;
  analyst_id: string;
  result: QaResult;
  error_category?: string | null;
  notes?: string | null;
  attachments?: string[];
  reviewed_at: string;
  created_at: string;
  work_package?: WorkPackage;
  reviewer?: User;
  analyst?: User;
}

export interface Correction {
  id: string;
  work_package_id: string;
  qa_review_id?: string | null;
  assigned_to: string;
  description: string;
  resolved: boolean;
  resolved_at?: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  work_package_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface FlowFile {
  id: string;
  work_package_id?: string | null;
  project_id?: string | null;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  created_at: string;
}

export type CompanyDocumentCategory = "sop" | "policy" | "reference" | "other";

export interface DocumentFolder {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyDocument {
  id: string;
  title: string;
  description?: string | null;
  category: CompanyDocumentCategory;
  folder_id: string | null;
  tags: string[];
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  /** When set, the doc has an in-Flow edited copy (content itself is fetched separately). */
  content_updated_at?: string | null;
  content_updated_by?: string | null;
  /** Latest published (acknowledgment-required) revision, if any. */
  current_revision_id?: string | null;
  /** Locked documents (e.g. the SOPs that steer Eddy's QA judgment) — only
   * admin-level users may edit, move, or delete. Everyone can read. */
  is_protected?: boolean;
  /** Demo / local fallback only */
  file_data_base64?: string;
  /** Demo / local fallback only — in-Flow edited copy */
  content_html_memory?: string | null;
}

export interface CompanyDocumentView extends CompanyDocument {
  uploaded_by_name?: string;
}

export type RevisionBlockChange = {
  type: "added" | "changed" | "removed";
  /** New block HTML; empty for removed blocks. */
  html: string;
  /** Previous block HTML; empty for added blocks. */
  prev_html: string;
};

/** A published, acknowledgment-required version of a company document. */
export interface DocumentRevision {
  id: string;
  document_id: string;
  revision_number: number;
  title: string;
  content_html: string;
  change_summary: string;
  changed_blocks: RevisionBlockChange[];
  requires_acknowledgment: boolean;
  published_by: string | null;
  published_at: string;
}

export interface DocumentAcknowledgment {
  id: string;
  revision_id: string;
  user_id: string;
  acknowledged_at: string;
}

export type ActivityEventType =
  | "status_change"
  | "assignment"
  | "time_log"
  | "qa_review"
  | "comment"
  | "file_upload"
  | "submit_qa"
  | "task_complete"
  | "correction_received"
  | "correction_resolved"
  | "help_flag";

export interface ActivityEvent {
  id: string;
  user_id: string;
  work_package_id?: string | null;
  type: ActivityEventType;
  summary: string;
  created_at: string;
}

export type NotificationType =
  | "new_assignment"
  | "task_due_soon"
  | "task_overdue"
  | "qa_review_needed"
  | "qa_passed"
  | "correction_issued"
  | "correction_resolved"
  | "comment_mention"
  | "file_uploaded"
  | "project_at_risk"
  | "employee_overloaded"
  | "work_stuck"
  | "workload_low"
  | "workload_empty"
  | "workload_needs_estimate"
  | "workload_clocked_idle"
  | "help_flag_raised"
  | "help_flag_escalated"
  | "help_flag_acknowledged"
  | "help_flag_resolved"
  | "missing_wrap_up"
  | "weekly_update_ready"
  | "record_edited"
  | "work_eligibility_alert"
  | "forecast_risk"
  | "qa_rejected"
  | "assignment_changed"
  | "department_alert"
  | "activity_gap"
  | "validation_run_complete"
  | "sop_updated"
  | "side_session_heavy"
  | "request_submitted"
  | "request_update"
  | "coaching_update"
  | "time_auto_clock_out";

/** High-level buckets for Notification Center filters */
export type NotificationCategory =
  | "help"
  | "workload"
  | "wrap_up"
  | "forecast"
  | "qa"
  | "task"
  | "project"
  | "assignment"
  | "department"
  | "other";

export type NotificationReadFilter = "all" | "unread" | "read";

export type HelpFlagReason =
  | "need_clarification"
  | "stuck_on_task"
  | "missing_information"
  | "system_issue"
  | "need_qa_guidance"
  | "workload_concern"
  | "other";

export type HelpFlagStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "dismissed";

export type HelpFlagSeverity = "warning" | "critical";

export interface HelpFlagRecord {
  id: string;
  employee_id: string;
  department_id?: string | null;
  team_id?: string | null;
  board_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  reason: HelpFlagReason;
  notes?: string | null;
  status: HelpFlagStatus;
  severity: HelpFlagSeverity;
  source: "task" | "dashboard" | "timer" | "wrap_up";
  created_at: string;
  updated_at: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  leader_note?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  dismissed_by?: string | null;
  dismissed_at?: string | null;
  dismissal_reason?: string | null;
  escalated_at?: string | null;
  wrap_up_id?: string | null;
}

export interface HelpFlagView extends HelpFlagRecord {
  employee_name: string;
  department_name?: string | null;
  team_name?: string | null;
  task_title?: string | null;
  project_name?: string | null;
  acknowledged_by_name?: string | null;
  resolved_by_name?: string | null;
  can_respond: boolean;
  can_assign: boolean;
}

export interface HelpFlagSettings {
  id: string;
  enabled: boolean;
  escalation_minutes: number;
  critical_idle_minutes: number;
  updated_at: string;
  updated_by?: string | null;
}

export interface HelpFlagReportMetrics {
  totalRequests: number;
  openCount: number;
  byDepartment: { departmentId: string; departmentName: string; count: number }[];
  byReason: { reason: HelpFlagReason; count: number }[];
  avgResponseTimeMinutes: number;
  avgResolutionTimeMinutes: number;
  repeatedBlockers: { userId: string; name: string; count: number }[];
  unresolvedCount: number;
}

export type WorkloadAlertType =
  | "running_out_of_work"
  | "no_assigned_work"
  | "needs_more_work_soon"
  | "task_almost_complete"
  | "needs_estimate";

export type WorkloadAlertSeverity = "info" | "warning" | "critical" | "needs_review";

export type WorkloadAlertStatus = "open" | "snoozed" | "dismissed" | "reviewed";

export interface WorkloadAlertRecord {
  id: string;
  employee_id: string;
  department_id?: string | null;
  team_id?: string | null;
  alert_type: WorkloadAlertType;
  severity: WorkloadAlertSeverity;
  remaining_hours?: number | null;
  current_task_id?: string | null;
  status: WorkloadAlertStatus;
  recommended_action: string;
  created_at: string;
  updated_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  snoozed_until?: string | null;
  dismissed_by?: string | null;
  dismissed_at?: string | null;
}

export interface WorkloadAlertView extends WorkloadAlertRecord {
  employee_name: string;
  department_name?: string | null;
  team_name?: string | null;
  current_task_title?: string | null;
  upcoming_task_count: number;
  upcoming_task_titles: string[];
  is_clocked_in: boolean;
  has_active_timer: boolean;
  can_assign: boolean;
}

export interface WorkloadAlertSettings {
  id: string;
  enabled: boolean;
  work_remaining_threshold_hours: number;
  snooze_duration_hours: number;
  department_ids: string[];
  team_ids: string[];
  /** Users who never trip workload or activity-gap alerts. */
  excluded_user_ids: string[];
  updated_at: string;
  updated_by?: string | null;
}

export interface WorkloadAlertReportMetrics {
  lowWorkloadCount: number;
  noWorkCount: number;
  avgUnusedCapacityHours: number;
  byDepartment: {
    departmentId: string;
    departmentName: string;
    alertCount: number;
    criticalCount: number;
  }[];
  avgResponseTimeHours: number;
  repeatedLowWorkload: { userId: string; name: string; alertCount: number }[];
  openAlerts: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string;
  related_entity_id: string;
  read_status: boolean;
  link?: string | null;
  created_at: string;
}

export interface ActionContribution {
  type: ActivityEventType;
  label: string;
  count: number;
  points: number;
}

export interface FlowScoreTrendPoint {
  date: string;
  label: string;
  flowScore: number;
  productivityScore: number;
  qualityScore: number;
  activityPoints: number;
  completions: number;
  hoursLogged: number;
}

/** Core employee scorecard KPIs */
export interface ScorecardMetrics {
  packagesCompleted: number;
  packagesCompletedMonth: number;
  packagesCompletedQuarter: number;
  hoursLogged: number;
  hoursLoggedMonth: number;
  hoursLoggedQuarter: number;
  avgCompletionTimeHours: number;
  qaPassRate: number;
  correctionsReceived: number;
  correctionsResolved: number;
  openCorrections: number;
  overdueWork: number;
  activeWork: number;
}

export interface ScorecardPeriodTrendPoint {
  period: string;
  label: string;
  packagesCompleted: number;
  hoursLogged: number;
  avgCompletionTimeHours: number;
  qaPassRate: number;
  correctionsReceived: number;
  correctionsResolved: number;
  overdueWork: number;
  activeWork: number;
}

export interface TeamScorecardSummary {
  employeeCount: number;
  averages: ScorecardMetrics;
  totals: Pick<
    ScorecardMetrics,
    | "packagesCompleted"
    | "hoursLogged"
    | "correctionsReceived"
    | "correctionsResolved"
    | "overdueWork"
    | "activeWork"
  >;
}

export interface AccountabilityFlag {
  severity: "critical" | "warning" | "info";
  code: string;
  message: string;
  metric?: number;
}

export interface CoachingInsight {
  priority: "high" | "medium" | "low";
  category: "quality" | "productivity" | "engagement" | "timeliness" | "workflow";
  title: string;
  recommendation: string;
  metric?: string;
  type?: "strength" | "weakness" | "opportunity";
}

/** Transparent factor in a Flow Score component */
export interface ScoreFactor {
  id: string;
  label: string;
  rawValue: number | string;
  normalizedScore: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface ComponentScore {
  score: number;
  weight: number;
  factors: ScoreFactor[];
}

export interface FlowScoreBreakdown {
  flowScore: number;
  formula: string;
  productivity: ComponentScore;
  quality: ComponentScore;
  onTime: ComponentScore;
  activity: ComponentScore;
  calculatedAt: string;
}

export interface FlowBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedReason?: string;
}

export interface FlowAchievement {
  id: string;
  title: string;
  description: string;
  earnedAt?: string;
  progress?: number;
  target?: number;
}

export interface EmployeeScorecard extends PeopleProfile {
  rank: number;
  totalRanked: number;
  managerName: string | null;
  scoreBreakdown: FlowScoreBreakdown;
  trend30: FlowScoreTrendPoint[];
  trend90: FlowScoreTrendPoint[];
  badges: FlowBadge[];
  achievements: FlowAchievement[];
  metrics: ScorecardMetrics;
  monthlyTrends: ScorecardPeriodTrendPoint[];
  quarterlyTrends: ScorecardPeriodTrendPoint[];
  actionPoints: number;
  actionPointsToday: number;
  actionBreakdown: ActionContribution[];
  trend: FlowScoreTrendPoint[];
  accountabilityFlags: AccountabilityFlag[];
  coachingInsights: CoachingInsight[];
  velocityPerWeek: number;
  engagementLevel: "high" | "medium" | "low";
  submissionsToQa: number;
  tasksCompleted: number;
}

export interface EmployeeRanking {
  rank: number;
  userId: string;
  name: string;
  flowScore: number;
  actionPoints: number;
  completedThisWeek: number;
  qaPassRate: number;
  trendDelta: number;
}

export interface AccountabilityEntry {
  userId: string;
  name: string;
  flags: AccountabilityFlag[];
  flowScore: number;
  overdueItems: number;
  stuckItems: number;
  openCorrections: number;
  daysSinceLastActivity: number | null;
}

export interface AccountabilityReport {
  generatedAt: string;
  criticalCount: number;
  warningCount: number;
  entries: AccountabilityEntry[];
}

export interface CoachingReportEntry {
  userId: string;
  name: string;
  flowScore: number;
  rank: number;
  insights: CoachingInsight[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  focusAreas: string[];
}

export interface CoachingReport {
  generatedAt: string;
  teamAverageScore: number;
  entries: CoachingReportEntry[];
}

export interface AccountabilityDashboard {
  departmentAvgFlowScore: number;
  teamProductivity: number;
  teamQaRate: number;
  topPerformers: EmployeeRanking[];
  mostImproved: EmployeeRanking[];
  mostConsistent: EmployeeRanking[];
  needsAttention: { userId: string; name: string; reason: string; flowScore: number }[];
  highestCorrectionRate: { userId: string; name: string; rate: number; count: number }[];
  mostOverdue: { userId: string; name: string; count: number }[];
  workloadDistribution: { userId: string; name: string; active: number; hours: number; flowScore: number }[];
  rankings: EmployeeRanking[];
  trends30: FlowScoreTrendPoint[];
}

export interface TeamPerformanceDashboard {
  teamFlowScore: number;
  teamActionPoints: number;
  avgQaPassRate: number;
  avgOnTimeRate: number;
  rankings: EmployeeRanking[];
  trends: FlowScoreTrendPoint[];
  accountability: AccountabilityReport;
  accountabilityDashboard: AccountabilityDashboard;
  coaching: CoachingReport;
  topPerformers: EmployeeRanking[];
  needsAttention: { userId: string; name: string; reason: string; flowScore: number }[];
  leaderboard: EmployeeRanking[];
}

export interface RollupMetrics {
  totalPackages: number;
  completedPackages: number;
  completedPct: number;
  hoursLogged: number;
  estimatedHours: number;
  fileCount: number;
  qaPassRate: number;
  correctionCount: number;
  overdueCount: number;
  stuckCount: number;
  readyForQa: number;
  lastActivityAt: string | null;
}

export interface ProjectRollup extends RollupMetrics {
  projectId: string;
  projectName: string;
  manufacturerCount: number;
  yearCount: number;
}

export interface ManufacturerRollup extends RollupMetrics {
  manufacturerId: string;
  manufacturerName: string;
  projectId: string;
  yearCount: number;
  completedYears: number;
}

export interface YearRollup extends RollupMetrics {
  yearWorkItemId: string;
  year: number;
  manufacturerId: string;
  projectId: string;
  packages: WorkPackage[];
}

export type ProjectMetricType =
  | "number"
  | "percentage"
  | "currency"
  | "hours"
  | "boolean"
  | "status"
  | "calculated";

export type ProjectMetricDisplayStyle =
  | "metric_card"
  | "progress_bar"
  | "percentage_ring"
  | "status_badge"
  | "target_vs_actual"
  | "trend_line"
  | "kpi_tile";

export type ProjectMetricStatusValue =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "complete";

export interface ProjectMetricFormulaDefinition {
  kind:
    | "qa_pass_rate"
    | "completion_pct"
    | "forecast_confidence"
    | "correction_count"
    | "hours_variance"
    | "documents_processed"
    | "files_uploaded"
    | "ready_for_qa";
  numeratorKey?: string;
  denominatorKey?: string;
  multiply?: number;
}

export interface ProjectMetricDefinition {
  id: string;
  project_id: string;
  metric_name: string;
  metric_description?: string | null;
  metric_type: ProjectMetricType;
  target_value?: number | null;
  current_value?: string | null;
  display_style: ProjectMetricDisplayStyle;
  sort_order: number;
  is_required: boolean;
  is_formula: boolean;
  formula_definition?: ProjectMetricFormulaDefinition | null;
  is_archived: boolean;
  created_at: string;
}

export interface ProjectMetricValue {
  id: string;
  metric_definition_id: string;
  current_value: string;
  previous_value?: string | null;
  updated_by?: string | null;
  updated_at: string;
}

export interface ProjectMetricView extends ProjectMetricDefinition {
  resolved_value: string;
  numeric_value: number | null;
  trend_7d?: number | null;
  trend_30d?: number | null;
  previous_value?: string | null;
}

export interface ExecutiveOutcomeMetric {
  id: string;
  metric_name: string;
  metric_type: ProjectMetricType;
  display_style: ProjectMetricDisplayStyle;
  aggregate_value: string;
  numeric_value: number | null;
  project_count: number;
  unit_label?: string;
}

export interface ProjectMetricExportRow {
  projectId: string;
  projectName: string;
  metricName: string;
  metricType: ProjectMetricType;
  value: string;
  target: string;
  previous: string | null;
  trend7d: string;
  trend30d: string;
  isFormula: boolean;
}

export interface ProjectMetricDefinitionInput {
  metric_name: string;
  metric_description?: string | null;
  metric_type: ProjectMetricType;
  target_value?: number | null;
  current_value?: string | null;
  display_style?: ProjectMetricDisplayStyle;
  sort_order?: number;
  is_required?: boolean;
  is_formula?: boolean;
  formula_definition?: ProjectMetricFormulaDefinition | null;
}

export interface OperationsTree {
  projects: ProjectTreeNode[];
}

export interface ProjectTreeNode {
  project: Project;
  rollup: ProjectRollup;
  manufacturers: ManufacturerTreeNode[];
}

export interface ManufacturerTreeNode {
  manufacturer: Manufacturer;
  rollup: ManufacturerRollup;
  years: YearTreeNode[];
}

export interface YearTreeNode {
  yearWorkItem: YearWorkItem;
  rollup: YearRollup;
  packages: WorkPackage[];
}

export interface ExecutiveMetrics {
  teamFlowScore: number;
  teamProductivity: number;
  teamQaRate: number;
  activePackages: number;
  overduePackages: number;
  stuckPackages: number;
  readyForQa: number;
  completedToday: number;
  completedThisWeek: number;
  hoursLoggedToday: number;
  qaPassRate: number;
  projectHealth: { name: string; completedPct: number; overdue: number; stuck: number }[];
  topPerformer: { userId: string; name: string; flowScore: number } | null;
  mostImproved: { userId: string; name: string; trendDelta: number; flowScore: number } | null;
  mostAtRisk: { userId: string; name: string; reason: string; flowScore: number } | null;
  topPerformers: { userId: string; name: string; flowScore: number }[];
  needsAttention: { userId: string; name: string; reason: string }[];
  workloadByAnalyst: { name: string; active: number; hours: number }[];
  departmentTrends: FlowScoreTrendPoint[];
}

export interface MetricExplanation {
  title: string;
  value: string | number;
  formula: string;
  source: string;
  drilldownHref?: string;
  factors?: { label: string; value: string | number }[];
}

export interface CommandCenterInsight {
  id: string;
  priority: "high" | "medium" | "low";
  text: string;
  metric: string;
  category: "productivity" | "quality" | "workload" | "qa" | "project";
  drilldownHref?: string;
}

export interface CommandCenterMetrics {
  teamHealth: {
    flowScore: number;
    productivityScore: number;
    qualityScore: number;
    onTimeScore: number;
    topPerformer: { userId: string; name: string; flowScore: number } | null;
    mostImproved: { userId: string; name: string; trendDelta: number; flowScore: number } | null;
    needsAttention: { userId: string; name: string; reason: string; flowScore: number } | null;
    mostOverloaded: { userId: string; name: string; active: number; hours: number } | null;
    lowestUtilization: { userId: string; name: string; active: number; hours: number } | null;
    scoreExplanations: {
      flow: MetricExplanation;
      productivity: MetricExplanation;
      quality: MetricExplanation;
      onTime: MetricExplanation;
    };
  };
  workload: {
    active: number;
    inProgress: number;
    readyForQa: number;
    correctionNeeded: number;
    overdue: number;
    stuck: number;
    avgActivePerEmployee: number;
    byEmployee: {
      userId: string;
      name: string;
      active: number;
      inProgress: number;
      overdue: number;
      stuck: number;
      hours: number;
      flag?: "overloaded" | "underutilized";
    }[];
  };
  projectHealth: {
    active: number;
    atRisk: number;
    onTrack: number;
    nearCompletion: number;
    projects: {
      id: string;
      name: string;
      completedPct: number;
      hoursLogged: number;
      qaRate: number;
      overdue: number;
      estimatedCompletion: string | null;
      status: "at_risk" | "on_track" | "near_completion";
      daysLate?: number | null;
      landingHeadline?: string | null;
      primaryReason?: string | null;
    }[];
  };
  qaHealth: {
    queueSize: number;
    avgTurnaroundHours: number;
    passRate: number;
    correctionsToday: number;
    correctionsThisWeek: number;
    bottlenecks: { label: string; count: number; href: string }[];
    highCorrectionAnalysts: { userId: string; name: string; rate: number; count: number }[];
  };
  accountability: {
    overdueEmployees: { userId: string; name: string; count: number }[];
    stuckEmployees: { userId: string; name: string; count: number }[];
    decliningScores: { userId: string; name: string; trendDelta: number; flowScore: number }[];
    repeatedQaFailures: { userId: string; name: string; corrections: number; qaPassRate: number }[];
    attentionList: {
      userId: string;
      name: string;
      category: "coaching" | "support" | "recognition";
      reason: string;
      priority: number;
      flowScore: number;
    }[];
  };
  insights: CommandCenterInsight[];
  trends30: FlowScoreTrendPoint[];
  wrapUpReview: WrapUpReviewDashboardStats;
  forecast: ForecastDashboardStats;
  workforce: {
    clockedIn: number;
    activeTaskTimers: number;
    documentsCompletedToday: number;
    capacityUtilizationPct: number;
  };
  workVisibility: WorkVisibilitySummary;
  activityGaps: ActivityGapView[];
  departmentHealth: import("@/lib/design/department-health").DepartmentHealthSummary[];
  recentActivity: ActivityEvent[];
  workloadAlerts: WorkloadAlertView[];
  workloadAlertSummary: {
    open: number;
    critical: number;
    warning: number;
    needsReview: number;
  };
  helpFlags: HelpFlagView[];
  helpFlagSummary: {
    open: number;
    critical: number;
    escalated: number;
  };
  /** Aggregated custom project outcome metrics across active projects */
  outcomeMetrics: ExecutiveOutcomeMetric[];
  /** Validation Center KPIs — present when viewer can access validation */
  validationSummary?: import("@/lib/validation-center/types").ValidationCenterKpis;
}

export interface DailyWrapUp {
  id: string;
  user_id: string;
  department_id?: string | null;
  wrap_date: string;
  completed_summary: string | null;
  blockers: string | null;
  needs_support: boolean;
  needs_support_note: string | null;
  clocked_minutes?: number | null;
  recorded_task_minutes?: number | null;
  unassigned_minutes?: number | null;
  task_tracking_compliance_pct?: number | null;
  activity_documentation_category?: ActivityDocumentationCategory | null;
  activity_documentation_note?: string | null;
  /**
   * Team-specific wrap-up answers, keyed by the operating model's
   * wrapUpFields ids (e.g. Advanced Projects' next_action / eta). Teams
   * without extra fields never set this.
   */
  sections?: Record<string, string> | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  internal_notes: string | null;
  follow_up_needed: boolean;
  follow_up_notes: string | null;
}

export type ActivityDocumentationCategory =
  | "meeting"
  | "training"
  | "research"
  | "supervisor_request"
  | "qa_review"
  | "administrative"
  | "system_issue"
  | "other";

export interface WorkVisibilitySettings {
  id: string;
  enabled: boolean;
  alerts_enabled: boolean;
  activity_gap_threshold_minutes: number;
  task_tracking_compliance_target_pct: number;
  daily_report_required: boolean;
  capacity_alert_threshold_pct: number;
  updated_at: string;
  updated_by: string | null;
}

export interface EmployeeWorkVisibilityMetrics {
  userId: string;
  userName: string;
  departmentId: string | null;
  departmentName: string | null;
  clockedMinutes: number;
  recordedTaskMinutes: number;
  unassignedMinutes: number;
  taskTrackingCompliancePct: number | null;
  documentsCompleted: number;
  qaAccuracyPct: number | null;
  dailyReportCompliancePct: number | null;
  workloadCoveragePct: number | null;
  capacityUtilizationPct: number | null;
  activityNotes: string | null;
  hasActiveActivityGap: boolean;
}

export interface WorkVisibilitySummary {
  score: number;
  taskTrackingCompliancePct: number;
  dailyReportCompliancePct: number;
  workloadCoveragePct: number;
  capacityVisibilityPct: number;
  workDocumentationPct: number;
  openActivityGaps: number;
}

export interface ActivityGapRecord {
  id: string;
  employee_id: string;
  department_id?: string | null;
  started_at: string;
  detected_at: string;
  status: "open" | "resolved";
  message: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface ActivityGapView extends ActivityGapRecord {
  employee_name: string;
  department_name?: string | null;
  gap_minutes: number;
}

export interface WorkVisibilityTrendPoint {
  date: string;
  score: number;
  taskTrackingCompliancePct: number;
  dailyReportCompliancePct: number;
}

export type WrapUpComplianceStatus = "submitted" | "missing" | "overridden";

/** Weekly manager update ("Friday section") — one row per manager per week. */
export interface ManagerWeeklyUpdate {
  id: string;
  user_id: string;
  team_id: string;
  /** yyyy-MM-dd of the Friday (org timezone) this update covers. */
  week_of: string;
  /** Answers keyed by the operating model's managerUpdate.fields ids. */
  sections: Record<string, string>;
  submitted_at: string;
  updated_at: string;
}

/** Employee weekly update — one row per employee per week, window-gated. */
export interface EmployeeWeeklyUpdate {
  id: string;
  user_id: string;
  team_id: string;
  /** yyyy-MM-dd of the Friday (org timezone) this update covers. */
  week_of: string;
  /** Answers keyed by the operating model's weeklyUpdates.fields ids. */
  sections: Record<string, string>;
  status: "submitted" | "reassigned";
  /** Prior submitted versions, oldest first. */
  revisions: { sections: Record<string, string>; submitted_at: string }[];
  submitted_at: string;
  updated_at: string;
  reassigned_by?: string | null;
  reassigned_note?: string | null;
}

export interface WeeklyUpdateComment {
  id: string;
  update_id: string;
  user_id: string;
  kind: "comment" | "reaction";
  body?: string | null;
  emoji?: string | null;
  created_at: string;
}

export interface DailyWrapUpOverride {
  id: string;
  user_id: string;
  wrap_date: string;
  reason: string;
  overridden_by: string;
  overridden_at: string;
}

export interface DailyWrapUpComplianceRow {
  userId: string;
  userName: string;
  departmentId: string | null;
  departmentName: string;
  wrapDate: string;
  wrapUpStatus: WrapUpComplianceStatus;
  clockedIn: boolean;
  clockedOutToday: boolean;
  clockOutAt: string | null;
  overrideReason: string | null;
  overriddenByName: string | null;
  blockedAttemptAt: string | null;
}

export type WrapUpClockOutStatus = "clocked_out" | "on_shift" | "not_clocked";

export interface WrapUpReviewRow {
  id: string;
  userId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  teamId: string | null;
  teamName: string | null;
  wrapDate: string;
  submittedAt: string | null;
  clockOutStatus: WrapUpClockOutStatus;
  clockOutAt: string | null;
  wrapUpStatus: WrapUpComplianceStatus;
  blockersPreview: string | null;
  notesPreview: string | null;
  hasBlockers: boolean;
  needsSupport: boolean;
  reviewed: boolean;
  reviewedByName: string | null;
  reviewedAt: string | null;
  followUpNeeded: boolean;
}

export interface WrapUpReviewDetail {
  wrapUp: DailyWrapUp;
  employeeName: string;
  departmentName: string;
  teamName: string | null;
  reviewedByName: string | null;
  wrapUpStatus: WrapUpComplianceStatus;
  clockOutStatus: WrapUpClockOutStatus;
  clockOutAt: string | null;
  shiftMinutesToday: number;
  clockEntries: TimeClockEntry[];
  tasksCompleted: WorkPackage[];
}

export interface WrapUpReviewDashboardStats {
  submittedToday: number;
  missingToday: number;
  unreviewed: number;
  withBlockers: number;
  followUpsNeeded: number;
}

export interface WrapUpReviewFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  departmentId?: string;
  teamId?: string;
  status?: WrapUpComplianceStatus | "all";
  reviewed?: "all" | "reviewed" | "unreviewed";
  followUpNeeded?: boolean;
}

export interface EmployeeQaReturn {
  package: WorkPackage;
  review: QaReview;
  reviewerName: string;
  correctionType: string;
  reason: string;
}

export interface EmployeeDailySummary {
  tasksCompletedToday: number;
  hoursWorkedToday: number;
  qaPasses: number;
  correctionsReceived: number;
  clockedIn: boolean;
  shiftMinutesToday: number | null;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  documentsUploadedToday: number;
}

export type EmployeeQueueSort = "priority" | "due_date" | "assigned_date";

export interface PeopleProfile {
  user: User;
  currentWork: WorkPackage[];
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  hoursLogged: number;
  avgHoursPerPackage: number;
  qaPassRate: number;
  corrections: number;
  onTimeRate: number;
  overdueItems: number;
  stuckItems: number;
  flowScore: number;
  productivityScore: number;
  qualityScore: number;
  onTimeScore: number;
  activityScore: number;
  recentActivity: ActivityEvent[];
  recentQaFeedback: QaReview[];
}

/** One person's live position inside a project — "who is where" without digging. */
export interface ProjectPersonPulse {
  userId: string;
  name: string;
  isClockedIn: boolean;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  /** True when the person's task timer is running on that task right now. */
  activeTaskIsLive: boolean;
  doneCount: number;
  openCount: number;
  totalCount: number;
  hoursLogged: number;
}

export type ProjectHoldupKind = "stuck" | "correction" | "overdue" | "waiting";

/** One named task that is holding a project up, with the reason spelled out. */
export interface ProjectHoldup {
  taskId: string;
  title: string;
  manufacturer: string | null;
  assigneeName: string | null;
  kind: ProjectHoldupKind;
  detail: string;
  /** Age in days — used to sort worst-first. */
  days: number;
}

/** Package counts by stage — "how much is left" at a glance. */
export interface ProjectRemainingBreakdown {
  notStarted: number;
  inMotion: number;
  waiting: number;
  inQa: number;
  correction: number;
  done: number;
  total: number;
}

export interface ProjectHealth {
  project: Project;
  overallProgress: number;
  manufacturerProgress: { name: string; completedPct: number; packages: number }[];
  hoursLogged: number;
  estimatedRemaining: number;
  qaIssues: number;
  blockedCount: number;
  overdueCount: number;
  assignedAnalysts: string[];
  projectedCompletion?: string | null;
  rollup: ProjectRollup;
  customMetrics: ProjectMetricView[];
  people: ProjectPersonPulse[];
  holdups: ProjectHoldup[];
  remaining: ProjectRemainingBreakdown;
}

export interface ReportMetrics {
  productivityByAnalyst: { name: string; completed: number; hours: number }[];
  qaPassRate: number;
  totalCorrections: number;
  avgTimePerPackage: number;
  overdueCount: number;
  stuckCount: number;
  completedByPeriod: { period: string; count: number }[];
  workloadByAnalyst: { name: string; active: number; hours: number }[];
  efficiencyByProject: { name: string; completed: number; avgHours: number }[];
  efficiencyByManufacturer: { name: string; completed: number; avgHours: number }[];
  performanceTrends: { date: string; flowScore: number }[];
  hierarchySummary: { projects: number; manufacturers: number; years: number; packages: number };
  forecast: ForecastReportMetrics;
  workloadAlerts: WorkloadAlertReportMetrics;
  helpFlags: HelpFlagReportMetrics;
  outcomeMetrics: ExecutiveOutcomeMetric[];
  projectMetricRows: ProjectMetricExportRow[];
}

export type ProjectInput = Pick<
  Project,
  | "name"
  | "description"
  | "project_type"
  | "structure_mode"
  | "status"
  | "priority"
  | "forecast_unit"
  | "start_date"
  | "due_date"
  | "project_owner_id"
  | "department_id"
  | "team_id"
  | "is_cross_department"
  | "manual_project_due_date"
  | "estimated_total_documents"
  | "planning_complexity_level"
> & {
  created_by?: string | null;
};

export type ManufacturerInput = Pick<
  Manufacturer,
  "project_id" | "name" | "assigned_to" | "status" | "priority" | "due_date" | "notes"
>;

export type YearWorkItemInput = Pick<
  YearWorkItem,
  | "manufacturer_id"
  | "project_id"
  | "year"
  | "assigned_to"
  | "status"
  | "priority"
  | "due_date"
  | "estimated_hours"
  | "notes"
>;

export type WorkPackageInput = Pick<
  WorkPackage,
  | "project_id"
  | "manufacturer_id"
  | "year_work_item_id"
  | "year"
  | "department_id"
  | "title"
  | "notes"
  | "description"
  | "assigned_to"
  | "status"
  | "priority"
  | "due_date"
  | "start_date"
  | "estimated_hours"
  | "estimated_document_count"
  | "estimated_minutes_per_document"
  | "forecast_unit"
  | "complexity_level"
  | "manual_due_date"
  | "qa_required"
  | "files_required"
>;

export type FeedbackCategory =
  | "idea"
  | "bug"
  | "issue"
  | "feature_request"
  | "question";

export type FeedbackPriority = "low" | "medium" | "high";

export type FeedbackStatus =
  | "new"
  | "investigating"
  | "planned"
  | "fixed"
  | "rejected";

export interface FeedbackSubmission {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  category: FeedbackCategory;
  title: string;
  description: string;
  priority: FeedbackPriority;
  screenshot_url: string | null;
  screenshot_storage_path: string | null;
  screenshot_mime_type: string | null;
  screenshot_file_name: string | null;
  page_url: string | null;
  app_version: string | null;
  device_info: string | null;
  status: FeedbackStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  /** Demo mode only — inline attachment bytes */
  screenshot_data_base64?: string;
}

export interface FeedbackSubmissionView extends FeedbackSubmission {
  assigned_to_name: string | null;
}

export type WorkItemInput = WorkPackageInput;
