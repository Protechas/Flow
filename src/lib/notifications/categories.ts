import type { NotificationCategory, NotificationType } from "@/types/flow";

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  help: "Open Escalations",
  workload: "Available Capacity",
  wrap_up: "Daily Reports",
  forecast: "Projects At Risk",
  qa: "QA",
  task: "Tasks",
  project: "Projects",
  assignment: "Assignments",
  department: "Departments",
  other: "Other",
};

export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  help_flag_raised: "help",
  help_flag_escalated: "help",
  help_flag_acknowledged: "help",
  help_flag_resolved: "help",
  workload_low: "workload",
  workload_empty: "workload",
  workload_needs_estimate: "workload",
  workload_clocked_idle: "workload",
  activity_gap: "workload",
  missing_wrap_up: "wrap_up",
  work_eligibility_alert: "workload",
  forecast_risk: "forecast",
  qa_review_needed: "qa",
  qa_passed: "qa",
  qa_rejected: "qa",
  correction_issued: "qa",
  correction_resolved: "qa",
  task_due_soon: "task",
  task_overdue: "task",
  work_stuck: "task",
  employee_overloaded: "task",
  project_at_risk: "project",
  new_assignment: "assignment",
  assignment_changed: "assignment",
  department_alert: "department",
  comment_mention: "other",
  file_uploaded: "other",
  validation_run_complete: "project",
  sop_updated: "other",
  side_session_heavy: "workload",
  request_submitted: "task",
  request_update: "task",
  coaching_update: "other",
  time_auto_clock_out: "workload",
};

export const NOTIFICATION_TYPE_LABELS: Partial<Record<NotificationType, string>> = {
  help_flag_raised: "Employee escalation opened",
  help_flag_escalated: "Escalation elevated",
  help_flag_acknowledged: "Escalation acknowledged",
  help_flag_resolved: "Escalation resolved",
  workload_low: "Low assigned workload",
  workload_empty: "No assigned work",
  workload_needs_estimate: "Needs work estimate",
  workload_clocked_idle: "Clocked in without work",
  activity_gap: "Activity gap",
  missing_wrap_up: "Outstanding daily report",
  work_eligibility_alert: "Off-clock work attempt",
  forecast_risk: "Project at risk",
  qa_review_needed: "QA review needed",
  qa_passed: "QA passed",
  qa_rejected: "QA rejected",
  correction_issued: "Correction needed",
  correction_resolved: "Correction resolved",
  task_due_soon: "Task due soon",
  task_overdue: "Task overdue",
  work_stuck: "Task stuck",
  employee_overloaded: "Employee overloaded",
  project_at_risk: "Project at risk",
  new_assignment: "New assignment",
  assignment_changed: "Assignment changed",
  department_alert: "Department alert",
  comment_mention: "Mention",
  file_uploaded: "File uploaded",
  sop_updated: "SOP updated",
  side_session_heavy: "Heavy meeting/training time",
  request_submitted: "New team request",
  request_update: "Request update",
  coaching_update: "Coaching session",
  time_auto_clock_out: "Auto clock-out",
};

export function categoryForType(type: NotificationType): NotificationCategory {
  return NOTIFICATION_TYPE_CATEGORY[type] ?? "other";
}

export function typesForCategory(category: NotificationCategory): NotificationType[] {
  return (Object.entries(NOTIFICATION_TYPE_CATEGORY) as [NotificationType, NotificationCategory][])
    .filter(([, cat]) => cat === category)
    .map(([type]) => type);
}

export const NOTIFICATION_CENTER_CATEGORIES: NotificationCategory[] = [
  "help",
  "workload",
  "wrap_up",
  "forecast",
  "qa",
  "task",
  "project",
  "assignment",
  "department",
  "other",
];
