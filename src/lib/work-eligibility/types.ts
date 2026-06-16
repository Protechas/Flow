export type WorkEligibilityAction =
  | "start_task"
  | "resume_task"
  | "complete_task"
  | "submit_task"
  | "upload_file"
  | "submit_qa"
  | "submit_correction"
  | "start_timer"
  | "resume_timer"
  | "pause_timer"
  | "stop_timer"
  | "log_production"
  | "mark_documents"
  | "submit_production";

export type WorkEligibilityStatus =
  | "eligible"
  | "off_clock"
  | "on_break"
  | "inactive"
  | "needs_setup"
  | "override_active";

export interface WorkEligibility {
  eligible: boolean;
  status: WorkEligibilityStatus;
  requiresClockIn: boolean;
  clockedIn: boolean;
  accountActive: boolean;
  onApprovedBreak: boolean;
  hasManagerOverride: boolean;
  reasons: string[];
  /** Shift minutes when clocked in */
  sessionMinutes: number;
}

export const WORK_ELIGIBILITY_ERROR = {
  CLOCK_IN_REQUIRED: "CLOCK_IN_REQUIRED",
  ON_BREAK: "ON_BREAK",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  SETUP_INCOMPLETE: "SETUP_INCOMPLETE",
  ACTIVE_TIMER_ON_CLOCK_OUT: "ACTIVE_TIMER_ON_CLOCK_OUT",
} as const;

export type WorkEligibilityErrorCode =
  (typeof WORK_ELIGIBILITY_ERROR)[keyof typeof WORK_ELIGIBILITY_ERROR];
