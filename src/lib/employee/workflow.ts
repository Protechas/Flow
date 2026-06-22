export type EmployeeWorkflowStatusLabel =
  | "clocked_out"
  | "on_lunch"
  | "clocked_in_no_task"
  | "working_on_task"
  | "task_submitted_for_review"
  | "daily_report_required"
  | "ready_to_clock_out";

export type {
  EmployeeWorkflowState,
  EmployeeWorkflowSnapshot,
  EmployeeWorkflowActions,
  EmployeeWorkflowBlocker,
  EmployeeWorkflowInput,
  WorkflowStep,
  WorkflowStepId,
} from "./workflow-state";

export { computeEmployeeWorkflowState } from "./workflow-state";

import {
  computeEmployeeWorkflowState,
  type EmployeeWorkflowInput,
  type EmployeeWorkflowState,
} from "./workflow-state";

const STATE_TO_LEGACY: Record<EmployeeWorkflowState, EmployeeWorkflowStatusLabel> = {
  CLOCKED_OUT: "clocked_out",
  ON_LUNCH: "on_lunch",
  CLOCKED_IN_NO_TASK: "clocked_in_no_task",
  CLOCKED_IN_ACTIVE_TASK: "working_on_task",
  TASK_READY_FOR_SUBMISSION: "working_on_task",
  TASK_SUBMITTED_FOR_REVIEW: "task_submitted_for_review",
  WRAPUP_REQUIRED: "daily_report_required",
  READY_TO_CLOCK_OUT: "ready_to_clock_out",
  READY_TO_WORK: "clocked_in_no_task",
  ACTIVE_TASK: "working_on_task",
};

export type EmployeeWorkflowGuide = {
  status: EmployeeWorkflowStatusLabel;
  statusTitle: string;
  statusDescription: string;
  nextStepTitle: string;
  nextStepDescription: string;
  steps: import("./workflow-state").WorkflowStep[];
  showNoTaskPanel: boolean;
  showNoAssignedWork: boolean;
  showRequestWork: boolean;
  showDailyReportGate: boolean;
  showReadyToClockOut: boolean;
  activeTaskId: string | null;
  nextTaskId: string | null;
};

/** Legacy adapter — prefer computeEmployeeWorkflowState */
export function buildEmployeeWorkflow(input: EmployeeWorkflowInput): EmployeeWorkflowGuide {
  const s = computeEmployeeWorkflowState(input);
  return {
    status: STATE_TO_LEGACY[s.state],
    statusTitle: s.statusTitle,
    statusDescription: s.statusDescription,
    nextStepTitle: s.nextStepTitle,
    nextStepDescription: s.nextStepDescription,
    steps: s.steps,
    showNoTaskPanel: s.showNoTaskPanel,
    showNoAssignedWork: s.showNoAssignedWork,
    showRequestWork: s.actions.requestWork,
    showDailyReportGate: s.actions.completeDailyReport,
    showReadyToClockOut: s.actions.clockOut,
    activeTaskId: s.activeTaskId,
    nextTaskId: s.nextTaskId,
  };
}
