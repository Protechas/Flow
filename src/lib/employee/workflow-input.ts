import { getEmployeeTasks, pickNextTask } from "@/lib/employee/tasks";
import { buildTaskSubmitChecklist } from "@/lib/employee/submit-checklist";
import type { EmployeeWorkflowInput } from "@/lib/employee/workflow-state";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type {
  PayType,
  TaskTimeEntry,
  TimeClockEntry,
  User,
  WorkPackage,
  WrapUpComplianceStatus,
} from "@/types/flow";
import type { WorkEligibility } from "@/lib/work-eligibility";

export function buildTaskPageWorkflowInput(opts: {
  user: User;
  task: WorkPackage;
  payType: PayType;
  workEligibility: WorkEligibility;
  activeClock: TimeClockEntry | null;
  todayClockEntries: TimeClockEntry[];
  activeTaskTimer: TaskTimeEntry | null;
  wrapUpStatus: WrapUpComplianceStatus;
  pendingWorkRequest?: boolean;
}): EmployeeWorkflowInput {
  const {
    user,
    task,
    payType,
    workEligibility,
    activeClock,
    todayClockEntries,
    activeTaskTimer,
    wrapUpStatus,
    pendingWorkRequest = false,
  } = opts;

  const board = getEmployeeTasks(user.id);
  const timerOnThisTask = activeTaskTimer?.task_id === task.id ? activeTaskTimer : null;
  const timerTask = activeTaskTimer
    ? board.all.find((t) => t.id === activeTaskTimer.task_id) ?? (timerOnThisTask ? task : null)
    : null;

  const stagedTask =
    !activeTaskTimer &&
    (task.status === "working_on_it" || task.status === "correction_needed")
      ? task
      : null;

  const submittedTask = ["ready_for_qa", "in_qa", "done"].includes(task.status) ? task : null;

  const nextFromBoard = pickNextTask(board.all);
  const nextTask =
    nextFromBoard && nextFromBoard.id !== task.id && nextFromBoard.id !== stagedTask?.id
      ? nextFromBoard
      : null;

  const taskReadyForSubmission = timerOnThisTask
    ? buildTaskSubmitChecklist(user, task.id).ready
    : false;

  return {
    useShiftClock: requiresShiftClock({ role: user.role, pay_type: payType }),
    workEligibility,
    activeClock,
    todayClockEntries,
    timerTask,
    stagedTask,
    submittedTask,
    activeTaskTimer,
    nextTask,
    wrapUpStatus,
    assignedTaskCount: board.all.filter((t) => t.status !== "done").length,
    taskReadyForSubmission,
    pendingWorkRequest,
  };
}
