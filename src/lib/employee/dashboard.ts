import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore } from "@/lib/data/flow-store";
import { getEmployeeScorecard } from "@/lib/data/performance";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getDocumentsUploadedToday,
  getShiftMinutesToday,
} from "@/lib/data/production-tracking";
import {
  bucketEmployeeTasks,
  compareTaskPriority,
  getEmployeeTasks,
  pickNextTask,
  type EmployeeTaskBoard,
} from "@/lib/employee/tasks";
import { buildEmployeeMyQueue, type EmployeeMyQueue } from "@/lib/employee/queue";
import { buildTaskSubmitChecklist } from "@/lib/employee/submit-checklist";
import { completedToday } from "@/lib/scoring/flow-score";
import type {
  ActivityEvent,
  DailyWrapUp,
  EmployeeDailySummary,
  EmployeeQaReturn,
  EmployeeScorecard,
  TaskTimeEntry,
  WorkPackage,
} from "@/types/flow";
import { format, isSameDay, parseISO, startOfDay } from "date-fns";

const QA_RESULT_LABEL: Record<string, string> = {
  minor_correction: "Minor correction",
  major_correction: "Major correction",
  rejected: "Rejected",
};

export interface EmployeeDashboard {
  board: EmployeeTaskBoard;
  myQueue: EmployeeMyQueue;
  nextTask: WorkPackage | null;
  currentTask: WorkPackage | null;
  activeTaskTimer: TaskTimeEntry | null;
  dueToday: WorkPackage[];
  qaReturns: EmployeeQaReturn[];
  recentlyCompleted: WorkPackage[];
  dailySummary: EmployeeDailySummary;
  scorecard: EmployeeScorecard | null;
  todayWrapUp: DailyWrapUp | null;
  recentActivity: ActivityEvent[];
  taskReadyForSubmission: boolean;
}

function tasksDueToday(tasks: WorkPackage[]): WorkPackage[] {
  const today = startOfDay(new Date());
  return tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.due_date &&
        isSameDay(parseISO(t.due_date), today)
    )
    .sort(compareTaskPriority);
}

function recentlyCompleted(tasks: WorkPackage[], limit = 5): WorkPackage[] {
  return tasks
    .filter((t) => t.status === "done" && t.completed_date)
    .sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""))
    .slice(0, limit);
}

function buildQaReturns(
  returned: WorkPackage[],
  store: ReturnType<typeof getFlowStore>
): EmployeeQaReturn[] {
  return returned.map((pkg) => {
    const review =
      store.qaReviews
        .filter((r) => r.work_package_id === pkg.id && r.result !== "pass")
        .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0] ?? null;

    const reviewer = review
      ? store.users.find((u) => u.id === review.reviewer_id)
      : null;

    return {
      package: pkg,
      review: review ?? {
        id: "pending",
        work_package_id: pkg.id,
        reviewer_id: "",
        analyst_id: pkg.assigned_to ?? "",
        result: pkg.qa_status === "major_correction" ? "major_correction" : "minor_correction",
        notes: pkg.notes,
        reviewed_at: pkg.updated_at,
        created_at: pkg.updated_at,
      },
      reviewerName: reviewer?.full_name ?? "QA Team",
      correctionType:
        review?.result
          ? QA_RESULT_LABEL[review.result] ?? review.result
          : QA_RESULT_LABEL[pkg.qa_status] ?? "Correction needed",
      reason: review?.notes ?? review?.error_category ?? "Review required — see QA feedback",
    };
  });
}

function buildEmployeeRecentActivity(
  userId: string,
  packages: WorkPackage[],
  store: ReturnType<typeof getFlowStore>,
  limit = 12
): ActivityEvent[] {
  const taskIds = new Set(packages.map((p) => p.id));
  return store.activity
    .filter(
      (e) =>
        e.user_id === userId ||
        (e.work_package_id != null && taskIds.has(e.work_package_id))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

function buildDailySummary(
  userId: string,
  tasks: WorkPackage[],
  store: ReturnType<typeof getFlowStore>
): EmployeeDailySummary {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const mine = tasks;
  const hoursWorkedToday = store.timeLogs
    .filter((t) => t.user_id === userId && t.log_date === todayStr)
    .reduce((s, t) => s + Number(t.hours), 0);

  const today = startOfDay(new Date());
  const qaPasses = store.qaReviews.filter(
    (r) =>
      r.analyst_id === userId &&
      r.result === "pass" &&
      isSameDay(parseISO(r.reviewed_at), today)
  ).length;

  const correctionsReceived = store.corrections.filter(
    (c) =>
      c.assigned_to === userId &&
      isSameDay(parseISO(c.created_at), today)
  ).length;

  return {
    tasksCompletedToday: completedToday(mine),
    hoursWorkedToday: Math.round(hoursWorkedToday * 10) / 10,
    qaPasses,
    correctionsReceived,
    clockedIn: false,
    shiftMinutesToday: null,
    activeTaskId: null,
    activeTaskTitle: null,
    documentsUploadedToday: 0,
  };
}

export async function getEmployeeDashboard(userId: string): Promise<EmployeeDashboard> {
  await ensureAppDataLoaded();
  const store = getFlowStore();
  const board = getEmployeeTasks(userId);
  const packages = board.all;
  const [scorecard] = await Promise.all([getEmployeeScorecard(userId)]);

  const nextTask = pickNextTask(board.all);
  const currentTask = board.inProgress[0] ?? null;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const activeClock = getActiveClockEntry(userId);
  const activeTaskTimer = getActiveTaskTimeEntry(userId);
  const activeTaskPkg = activeTaskTimer
    ? packages.find((p) => p.id === activeTaskTimer.task_id) ?? null
    : null;
  const resolvedCurrent = activeTaskPkg ?? currentTask;
  const user = store.users.find((u) => u.id === userId);
  const taskReadyForSubmission =
    user && activeTaskTimer?.task_id
      ? buildTaskSubmitChecklist(user, activeTaskTimer.task_id).ready
      : false;

  return {
    board,
    myQueue: buildEmployeeMyQueue({
      packages,
      currentTask: resolvedCurrent,
      activeTaskTimer,
    }),
    nextTask,
    currentTask: resolvedCurrent,
    activeTaskTimer,
    dueToday: tasksDueToday(packages),
    qaReturns: buildQaReturns(board.returned, store),
    recentlyCompleted: recentlyCompleted(packages),
    dailySummary: {
      ...buildDailySummary(userId, packages, store),
      clockedIn: activeClock != null,
      shiftMinutesToday: getShiftMinutesToday(userId),
      activeTaskId: activeTaskTimer?.task_id ?? null,
      activeTaskTitle: activeTaskPkg?.title ?? null,
      documentsUploadedToday: getDocumentsUploadedToday(userId),
    },
    scorecard,
    todayWrapUp: store.dailyWrapUps.find(
      (w) => w.user_id === userId && w.wrap_date === todayStr
    ) ?? null,
    recentActivity: buildEmployeeRecentActivity(userId, packages, store),
    taskReadyForSubmission,
  };
}

