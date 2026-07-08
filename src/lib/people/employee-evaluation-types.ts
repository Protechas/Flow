/** Client-safe types + labels for the employee evaluation panel. */

export type IncidentCategory =
  | "time_clock"
  | "task_timer"
  | "daily_report"
  | "qa_quality"
  | "attendance"
  | "conduct"
  | "process"
  | "other";

export type IncidentSeverity = "minor" | "moderate" | "serious";

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  time_clock: "Time clock",
  task_timer: "Task timer",
  daily_report: "Daily report",
  qa_quality: "QA / quality",
  attendance: "Attendance",
  conduct: "Conduct",
  process: "Process",
  other: "Other",
};

export interface EmployeeIncident {
  id: string;
  employee_id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  summary: string;
  notes: string | null;
  occurred_on: string;
  task_id: string | null;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

/** Automatic evaluation signals computed from existing operational data. */
export interface EvaluationSignals {
  /** Clock punches corrected or added by someone else (last 90 days). */
  clockCorrections: number;
  clockCorrectionDetails: { date: string; editor: string; reason: string }[];
  /** Days clocked in without a daily report (last 30 days). */
  missedWrapUps: number;
  /** QA corrections across the employee's tasks. */
  qaCorrections: number;
  /** Failed/correction QA reviews recorded on their tasks. */
  qaReviewReturns: number;
}
