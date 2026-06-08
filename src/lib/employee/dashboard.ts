import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getEmployeeScorecard } from "@/lib/data/performance";
import { getWorkPackages } from "@/lib/data/work-packages";
import {
  bucketEmployeeTasks,
  compareTaskPriority,
  getEmployeeTasks,
  pickNextTask,
  type EmployeeTaskBoard,
} from "@/lib/employee/tasks";
import { completedToday } from "@/lib/scoring/flow-score";
import type {
  DailyWrapUp,
  EmployeeDailySummary,
  EmployeeQaReturn,
  EmployeeScorecard,
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
  nextTask: WorkPackage | null;
  currentTask: WorkPackage | null;
  dueToday: WorkPackage[];
  qaReturns: EmployeeQaReturn[];
  recentlyCompleted: WorkPackage[];
  dailySummary: EmployeeDailySummary;
  scorecard: EmployeeScorecard | null;
  todayWrapUp: DailyWrapUp | null;
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
  };
}

export async function getEmployeeDashboard(userId: string): Promise<EmployeeDashboard> {
  initFlowStore();
  const store = getFlowStore();
  const [board, scorecard, packages] = await Promise.all([
    getEmployeeTasks(userId),
    getEmployeeScorecard(userId),
    getWorkPackages({ assignedTo: userId }),
  ]);

  const nextTask = pickNextTask(board.all);
  const currentTask = board.inProgress[0] ?? null;
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return {
    board,
    nextTask,
    currentTask,
    dueToday: tasksDueToday(packages),
    qaReturns: buildQaReturns(board.returned, store),
    recentlyCompleted: recentlyCompleted(packages),
    dailySummary: buildDailySummary(userId, packages, store),
    scorecard,
    todayWrapUp: store.dailyWrapUps.find(
      (w) => w.user_id === userId && w.wrap_date === todayStr
    ) ?? null,
  };
}

