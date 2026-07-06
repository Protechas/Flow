import { getFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { getAnalysts } from "@/lib/data/projects";
import { isQueueForecastTask } from "@/lib/forecast/assignee-queue";
import { userDisplayName } from "@/lib/users/display-name";
import type { QaReview, User, WorkPackage } from "@/types/flow";

export interface AssigneeSuggestion {
  userId: string;
  name: string;
  score: number;
  openTasks: number;
  openHours: number;
  familiarCompleted: number;
  qaPassRatePct: number | null;
  reasons: string[];
}

function openHoursFor(pkg: WorkPackage): number {
  if (pkg.estimated_hours && pkg.estimated_hours > 0) return pkg.estimated_hours;
  return 2; // conservative default so untracked estimates still count as load
}

function rankAssigneesForTask(
  task: WorkPackage,
  packages: WorkPackage[],
  analysts: User[],
  qaReviews: QaReview[],
  limit = 3
): AssigneeSuggestion[] {
  const suggestions = analysts.map((user) => {
    const mine = packages.filter((p) => p.assigned_to === user.id);
    const openQueue = mine.filter(isQueueForecastTask);
    const openTasks = openQueue.length;
    const openHours = openQueue.reduce((sum, p) => sum + openHoursFor(p), 0);

    const familiarCompleted = mine.filter(
      (p) => p.status === "done" && p.manufacturer_id === task.manufacturer_id
    ).length;

    const myReviews = qaReviews.filter((r) => r.analyst_id === user.id);
    const passed = myReviews.filter((r) => r.result === "pass").length;
    const qaPassRatePct =
      myReviews.length >= 3 ? Math.round((passed / myReviews.length) * 100) : null;

    const loadScore = 1 / (1 + openHours / 8);
    const famScore = Math.min(familiarCompleted, 10) / 10;
    const qaScore = qaPassRatePct != null ? qaPassRatePct / 100 : 0.75;
    const score = 0.45 * loadScore + 0.3 * famScore + 0.25 * qaScore;

    const reasons: string[] = [];
    reasons.push(
      openTasks === 0
        ? "No open work — available now"
        : `${openTasks} open task${openTasks === 1 ? "" : "s"} (~${Math.round(openHours)}h queued)`
    );
    if (familiarCompleted > 0) {
      reasons.push(`${familiarCompleted} completed for this workstream`);
    }
    if (qaPassRatePct != null) {
      reasons.push(`${qaPassRatePct}% QA pass rate`);
    }

    return {
      userId: user.id,
      name: userDisplayName(user),
      score,
      openTasks,
      openHours: Math.round(openHours * 10) / 10,
      familiarCompleted,
      qaPassRatePct,
      reasons,
    };
  });

  return suggestions
    .filter((s) => s.userId !== task.assigned_to)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Pure ranking for in-process forecast/ops logic (no server round-trip). */
export function rankAssigneesForTaskSync(
  task: WorkPackage,
  packages: WorkPackage[],
  analysts: User[],
  qaReviews: QaReview[],
  limit = 3
): AssigneeSuggestion[] {
  return rankAssigneesForTask(task, packages, analysts, qaReviews, limit);
}

/**
 * Rank the best assignees for a task using data Flow already has:
 * current queue load, history with the same manufacturer, and QA pass rate.
 */
export async function suggestAssignees(
  taskId: string,
  limit = 3
): Promise<AssigneeSuggestion[]> {
  const packages = await getWorkPackages();
  const task = packages.find((p) => p.id === taskId);
  if (!task) return [];

  const store = getFlowStore();
  const analysts = await getAnalysts();

  return rankAssigneesForTask(task, packages, analysts, store.qaReviews, limit);
}
