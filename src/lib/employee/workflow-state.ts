import { getEmployeeClockStatus } from "@/lib/time-clock/labels";
import type { WorkEligibility } from "@/lib/work-eligibility";
import type {
  TaskTimeEntry,
  TimeClockEntry,
  WorkPackage,
  WrapUpComplianceStatus,
} from "@/types/flow";

/** Canonical employee workflow states — all UI derives from these. */
export type EmployeeWorkflowState =
  | "CLOCKED_OUT"
  | "ON_LUNCH"
  | "CLOCKED_IN_NO_TASK"
  | "CLOCKED_IN_ACTIVE_TASK"
  | "TASK_READY_FOR_SUBMISSION"
  | "TASK_SUBMITTED_FOR_REVIEW"
  | "WRAPUP_REQUIRED"
  | "READY_TO_CLOCK_OUT"
  | "READY_TO_WORK"
  | "ACTIVE_TASK";

export type WorkflowStepId =
  | "clock_in"
  | "start_task"
  | "track_progress"
  | "submit_task"
  | "daily_report"
  | "clock_out";

export interface WorkflowStep {
  id: WorkflowStepId;
  label: string;
  state: "complete" | "current" | "upcoming" | "blocked";
}

export interface EmployeeWorkflowBlocker {
  id: string;
  label: string;
}

export interface EmployeeWorkflowActions {
  clockIn: boolean;
  clockOutLunch: boolean;
  clockOut: boolean;
  startTask: boolean;
  continueTask: boolean;
  viewActiveTask: boolean;
  completeDailyReport: boolean;
  requestWork: boolean;
  requestHelp: boolean;
  uploadFiles: boolean;
  submitWrapUp: boolean;
}

export interface EmployeeWorkflowSnapshot {
  state: EmployeeWorkflowState;
  statusTitle: string;
  statusDescription: string;
  nextStepTitle: string;
  nextStepDescription: string;
  blockers: EmployeeWorkflowBlocker[];
  actions: EmployeeWorkflowActions;
  steps: WorkflowStep[];
  /** Task with an active work record (in progress or timer) while eligible to work */
  activeTask: WorkPackage | null;
  /** Next assignable task in queue */
  nextTask: WorkPackage | null;
  /** Task shown on mission card — active when working, next when idle & eligible */
  missionTask: WorkPackage | null;
  missionMode: "none" | "active" | "next" | "paused" | "staged" | "clock_in_to_resume";
  activeTaskId: string | null;
  /** Clock-out should only be interrupted by a RUNNING timer — a paused one already saved its progress. */
  clockOutBlockedByTask: boolean;
  stagedTaskId: string | null;
  uploadTaskId: string | null;
  nextTaskId: string | null;
  wrapUpComplete: boolean;
  useShiftClock: boolean;
  workEligible: boolean;
  showNoTaskPanel: boolean;
  showNoAssignedWork: boolean;
  statusAccent: "neutral" | "success" | "warning" | "danger";
  pendingWorkRequest: boolean;
}

const STEP_LABELS: Record<WorkflowStepId, string> = {
  clock_in: "Clock In",
  start_task: "Start Assigned Task",
  track_progress: "Upload Work / Track Progress",
  submit_task: "Submit Task",
  daily_report: "Submit Daily Report",
  clock_out: "Clock Out",
};

const IN_PROGRESS = new Set([
  "assigned",
  "working_on_it",
  "waiting",
  "stuck",
  "correction_needed",
]);

const SUBMITTED = new Set(["ready_for_qa", "in_qa", "done"]);

function wrapUpDone(status: WrapUpComplianceStatus) {
  return status === "submitted" || status === "overridden";
}

function isTimerLive(timer: TaskTimeEntry | null): boolean {
  return timer?.status === "active" || timer?.status === "paused";
}

/** Active work = live timer only (not merely task status). */
function resolveTimerTask(
  activeTaskTimer: TaskTimeEntry | null,
  currentTask: WorkPackage | null
): WorkPackage | null {
  if (!isTimerLive(activeTaskTimer)) return null;
  const taskId = activeTaskTimer!.task_id;
  if (currentTask?.id === taskId) return currentTask;
  return null;
}

/** Task marked in progress but timer not running — needs explicit start/resume. */
function resolveStagedTask(
  activeTaskTimer: TaskTimeEntry | null,
  stagedTask: WorkPackage | null
): WorkPackage | null {
  if (isTimerLive(activeTaskTimer)) return null;
  return stagedTask;
}

function resolveSubmittedTask(submittedTask: WorkPackage | null): WorkPackage | null {
  if (submittedTask && SUBMITTED.has(submittedTask.status)) return submittedTask;
  return null;
}

export interface EmployeeWorkflowInput {
  useShiftClock: boolean;
  workEligibility: WorkEligibility;
  activeClock: TimeClockEntry | null;
  todayClockEntries: TimeClockEntry[];
  /** Package matching the live task timer */
  timerTask: WorkPackage | null;
  /** In-progress task without a running timer */
  stagedTask: WorkPackage | null;
  /** Task in QA / submitted state */
  submittedTask: WorkPackage | null;
  activeTaskTimer: TaskTimeEntry | null;
  nextTask: WorkPackage | null;
  wrapUpStatus: WrapUpComplianceStatus;
  assignedTaskCount: number;
  taskReadyForSubmission?: boolean;
  pendingWorkRequest?: boolean;
}

export function computeEmployeeWorkflowState(
  input: EmployeeWorkflowInput
): EmployeeWorkflowSnapshot {
  const {
    useShiftClock,
    workEligibility,
    activeClock,
    todayClockEntries,
    timerTask,
    stagedTask: stagedTaskInput,
    submittedTask: submittedTaskInput,
    activeTaskTimer,
    nextTask,
    wrapUpStatus,
    assignedTaskCount,
    taskReadyForSubmission = false,
    pendingWorkRequest = false,
  } = input;

  const workEligible = workEligibility.eligible;
  const clockState = useShiftClock
    ? getEmployeeClockStatus(activeClock, todayClockEntries)
    : "on_shift";
  const onShift = !useShiftClock || clockState === "on_shift";
  const onLunch = useShiftClock && clockState === "on_lunch";
  const clockedOut = useShiftClock && clockState === "off_shift";
  const dailyDone = wrapUpDone(wrapUpStatus);

  const timerLive = isTimerLive(activeTaskTimer);
  const liveTask = resolveTimerTask(activeTaskTimer, timerTask);
  const stagedTask = resolveStagedTask(activeTaskTimer, stagedTaskInput);
  const submittedTask = resolveSubmittedTask(submittedTaskInput);

  const hasActiveWork = Boolean(liveTask) && workEligible && timerLive;
  const activeTask = hasActiveWork ? liveTask : null;
  const activeTaskId = activeTask?.id ?? null;
  const stagedTaskId = stagedTask?.id ?? null;
  const effectiveNext =
    nextTask && nextTask.id !== stagedTaskId && nextTask.id !== activeTaskId ? nextTask : null;
  const nextTaskId = effectiveNext?.id ?? null;
  const timerPaused = activeTaskTimer?.status === "paused";

  const uploadTaskId = activeTaskId ?? stagedTaskId ?? nextTaskId;

  let state: EmployeeWorkflowState;

  if (!useShiftClock) {
    if (hasActiveWork) {
      state = taskReadyForSubmission ? "TASK_READY_FOR_SUBMISSION" : "ACTIVE_TASK";
    } else if (stagedTask && workEligible) {
      state = "READY_TO_WORK";
    } else if (submittedTask) {
      state = "TASK_SUBMITTED_FOR_REVIEW";
    } else {
      state = "READY_TO_WORK";
    }
  } else if (onLunch) {
    state = "ON_LUNCH";
  } else if (clockedOut || !onShift) {
    state = "CLOCKED_OUT";
  } else if (hasActiveWork) {
    state = taskReadyForSubmission ? "TASK_READY_FOR_SUBMISSION" : "CLOCKED_IN_ACTIVE_TASK";
  } else if (stagedTask && workEligible) {
    state = "CLOCKED_IN_NO_TASK";
  } else if (submittedTask) {
    state = dailyDone ? "READY_TO_CLOCK_OUT" : "TASK_SUBMITTED_FOR_REVIEW";
  } else if (dailyDone) {
    state = "READY_TO_CLOCK_OUT";
  } else if (nextTask || assignedTaskCount > 0) {
    state = "CLOCKED_IN_NO_TASK";
  } else {
    state = "WRAPUP_REQUIRED";
  }

  const blockers: EmployeeWorkflowBlocker[] = [];
  if (!workEligible && useShiftClock && (clockedOut || onLunch)) {
    blockers.push({
      id: "clock_in",
      label: onLunch
        ? "Clock back in before starting work."
        : "You must be clocked in before starting work.",
    });
  }
  if (!dailyDone && useShiftClock && onShift && !hasActiveWork && state === "TASK_SUBMITTED_FOR_REVIEW") {
    blockers.push({
      id: "daily_report",
      label: "Complete your end-of-day report before clocking out.",
    });
  }
  if (!dailyDone && useShiftClock && onShift && state === "WRAPUP_REQUIRED") {
    blockers.push({
      id: "daily_report",
      label: "Complete your end-of-day report before clocking out.",
    });
  }
  if (hasActiveWork && useShiftClock && onShift && dailyDone) {
    blockers.push({
      id: "active_task_clock_out",
      label: "Submit or pause your active task before clocking out.",
    });
  }
  if (stagedTask && workEligible && onShift) {
    blockers.push({
      id: "timer_not_started",
      label: "Start your task timer to record work on this task.",
    });
  }

  const actions: EmployeeWorkflowActions = {
    clockIn: useShiftClock && (clockedOut || onLunch),
    clockOutLunch: useShiftClock && onShift,
    clockOut: useShiftClock && onShift && dailyDone,
    startTask: workEligible && !activeTaskId && Boolean(nextTaskId || stagedTaskId),
    continueTask: workEligible && Boolean(activeTaskId),
    viewActiveTask: workEligible && Boolean(activeTaskId),
    completeDailyReport: useShiftClock && onShift && !dailyDone,
    requestWork: workEligible && assignedTaskCount === 0 && !pendingWorkRequest,
    requestHelp: true,
    uploadFiles: workEligible && Boolean(activeTaskId ?? stagedTaskId ?? nextTaskId),
    submitWrapUp: useShiftClock ? onShift && !dailyDone : !dailyDone,
  };

  let missionTask: WorkPackage | null = null;
  let missionMode: EmployeeWorkflowSnapshot["missionMode"] = "none";
  if (activeTask) {
    missionTask = activeTask;
    missionMode = timerPaused ? "paused" : "active";
  } else if (stagedTask && workEligible) {
    missionTask = stagedTask;
    missionMode = "staged";
  } else if (workEligible && effectiveNext) {
    missionTask = effectiveNext;
    missionMode = "next";
  } else if ((stagedTask ?? liveTask) && !workEligible) {
    missionTask = stagedTask ?? liveTask;
    missionMode = "clock_in_to_resume";
  }

  const clockStepDone = !useShiftClock || onShift;
  const taskStarted = Boolean(activeTaskId);
  const taskSubmitted = Boolean(submittedTask) || (state === "TASK_SUBMITTED_FOR_REVIEW");

  const steps: WorkflowStep[] = [
    {
      id: "clock_in",
      label: STEP_LABELS.clock_in,
      state: clockStepDone ? "complete" : clockedOut || onLunch ? "current" : "blocked",
    },
    {
      id: "start_task",
      label: STEP_LABELS.start_task,
      state: !clockStepDone
        ? "upcoming"
        : taskStarted
          ? "complete"
          : assignedTaskCount > 0
            ? "current"
            : "blocked",
    },
    {
      id: "track_progress",
      label: STEP_LABELS.track_progress,
      state: !taskStarted ? "upcoming" : taskSubmitted ? "complete" : "current",
    },
    {
      id: "submit_task",
      label: STEP_LABELS.submit_task,
      state: !taskStarted ? "upcoming" : taskSubmitted ? "complete" : "current",
    },
    {
      id: "daily_report",
      label: STEP_LABELS.daily_report,
      state: !useShiftClock
        ? "upcoming"
        : dailyDone
          ? "complete"
          : clockStepDone && (taskSubmitted || !activeTaskId)
            ? "current"
            : "upcoming",
    },
    {
      id: "clock_out",
      label: STEP_LABELS.clock_out,
      state:
        useShiftClock && onShift && dailyDone && !activeTaskId
          ? "current"
          : useShiftClock && clockStepDone && dailyDone
            ? "complete"
            : "upcoming",
    },
  ];

  let statusTitle = "Clocked Out";
  let statusDescription = "Clock in to begin today's work.";
  let nextStepTitle = "Clock in to begin work";
  let nextStepDescription = "You must be clocked in before starting work.";
  let statusAccent: EmployeeWorkflowSnapshot["statusAccent"] = "danger";

  switch (state) {
    case "ON_LUNCH":
      statusTitle = "On Lunch";
      statusDescription = "Clock back in when your break is over.";
      nextStepTitle = "Clock back in";
      nextStepDescription = "Resume your shift when you return from lunch.";
      statusAccent = "warning";
      break;
    case "CLOCKED_OUT":
      if (stagedTask || liveTask) {
        const t = stagedTask ?? liveTask!;
        statusTitle = "Clocked Out";
        statusDescription = `You have work in progress: ${t.title}`;
        nextStepTitle = "Clock in to continue your task";
        nextStepDescription = "You must be clocked in before resuming work.";
      }
      statusAccent = "danger";
      break;
    case "CLOCKED_IN_NO_TASK":
      if (stagedTask) {
        statusTitle = "Task Ready — Timer Not Started";
        statusDescription = `${stagedTask.title} is assigned but your timer is not running.`;
        nextStepTitle = "Start your task timer";
        nextStepDescription = "Start the timer to record work time before uploading files.";
      } else {
        statusTitle = "Clocked In — No Active Task";
        statusDescription = "You are clocked in with no active work record.";
        nextStepTitle = effectiveNext ? "Start your assigned task" : "Request work";
        nextStepDescription = effectiveNext
          ? `Start: ${effectiveNext.title}`
          : "No assigned work is currently available. Request work to notify your team lead.";
      }
      statusAccent = "warning";
      break;
    case "CLOCKED_IN_ACTIVE_TASK":
    case "ACTIVE_TASK":
      statusTitle = "Working On Task";
      statusDescription = activeTask?.title ?? "Continue your assigned work.";
      nextStepTitle = timerPaused ? "Resume your task" : "Upload work or submit task";
      nextStepDescription = "Open your task to upload files and submit for review when ready.";
      statusAccent = "success";
      break;
    case "TASK_READY_FOR_SUBMISSION":
      statusTitle = "Working On Task";
      statusDescription = activeTask?.title ?? "Your task is ready to submit.";
      nextStepTitle = "Submit task for review";
      nextStepDescription = "Required files are uploaded. Submit when you are finished.";
      statusAccent = "success";
      break;
    case "TASK_SUBMITTED_FOR_REVIEW":
      statusTitle = "Task Submitted For Review";
      statusDescription = submittedTask?.title ?? "Your task is in the review queue.";
      nextStepTitle = dailyDone ? "Clock out" : "Complete your daily report";
      nextStepDescription = dailyDone
        ? "Your daily report is complete. You may clock out."
        : "Submit your end-of-day report before clocking out.";
      statusAccent = "success";
      break;
    case "WRAPUP_REQUIRED":
      statusTitle = "Daily Report Required";
      statusDescription = "Complete your end-of-day report before clocking out.";
      nextStepTitle = "Complete your daily report";
      nextStepDescription = "Please complete your end-of-day report before clocking out.";
      statusAccent = "warning";
      break;
    case "READY_TO_CLOCK_OUT":
      statusTitle = "Ready To Clock Out";
      statusDescription = "Daily report submitted. You may end your shift.";
      nextStepTitle = "Clock out";
      nextStepDescription = "End your shift when you are finished for the day.";
      statusAccent = "success";
      break;
    case "READY_TO_WORK":
      if (stagedTask) {
        statusTitle = "Task Ready — Timer Not Started";
        statusDescription = `${stagedTask.title} is assigned but your timer is not running.`;
        nextStepTitle = "Start your task timer";
        nextStepDescription = "Start the timer to record work time before uploading files.";
      } else {
        statusTitle = "Ready To Work";
        statusDescription = effectiveNext
          ? "Start your next assigned task."
          : "No active task assigned.";
        nextStepTitle = effectiveNext
          ? "Start your assigned task"
          : assignedTaskCount === 0
            ? "Request work from your team lead"
            : "Review your task queue";
        nextStepDescription = effectiveNext
          ? `Next up: ${effectiveNext.title}`
          : "Use Request Work if you need additional assignments.";
      }
      statusAccent = "success";
      break;
  }

  const showNoTaskPanel =
    useShiftClock &&
    onShift &&
    !activeTaskId &&
    !onLunch &&
    (state === "CLOCKED_IN_NO_TASK" || Boolean(stagedTask));

  return {
    state,
    statusTitle,
    statusDescription,
    nextStepTitle,
    nextStepDescription,
    blockers,
    actions,
    steps,
    activeTask,
    nextTask: effectiveNext,
    missionTask,
    missionMode,
    activeTaskId,
    clockOutBlockedByTask: Boolean(activeTask) && activeTaskTimer?.status === "active",
    stagedTaskId,
    uploadTaskId,
    nextTaskId,
    wrapUpComplete: dailyDone,
    useShiftClock,
    workEligible,
    showNoTaskPanel,
    showNoAssignedWork: assignedTaskCount === 0,
    statusAccent,
    pendingWorkRequest,
  };
}
