import { getWorkPackages } from "@/lib/data/work-packages";
import {
  compareTaskPriority,
  type EmployeeTaskBoard,
} from "@/lib/employee/task-utils";
import type { WorkPackage, WorkStatus } from "@/types/flow";

export type { EmployeeTaskBoard } from "@/lib/employee/task-utils";
export { compareTaskPriority } from "@/lib/employee/task-utils";

export function bucketEmployeeTasks(tasks: WorkPackage[]): EmployeeTaskBoard {
  const myTasks: WorkPackage[] = [];
  const inProgress: WorkPackage[] = [];
  const waitingQa: WorkPackage[] = [];
  const returned: WorkPackage[] = [];
  const completed: WorkPackage[] = [];

  for (const t of tasks) {
    switch (t.status) {
      case "done":
        completed.push(t);
        break;
      case "ready_for_qa":
      case "in_qa":
        waitingQa.push(t);
        break;
      case "correction_needed":
        returned.push(t);
        break;
      case "working_on_it":
        inProgress.push(t);
        break;
      default:
        if (["not_started", "assigned", "waiting", "stuck"].includes(t.status)) {
          myTasks.push(t);
        } else {
          myTasks.push(t);
        }
    }
  }

  const sortFn = (a: WorkPackage, b: WorkPackage) => compareTaskPriority(a, b);

  return {
    myTasks: myTasks.sort(sortFn),
    inProgress: inProgress.sort(sortFn),
    waitingQa: waitingQa.sort(sortFn),
    returned: returned.sort(sortFn),
    completed: completed.sort(sortFn),
    all: [...tasks].sort(sortFn),
  };
}

const NEXT_STATUSES: WorkStatus[] = [
  "correction_needed",
  "assigned",
  "not_started",
  "working_on_it",
  "waiting",
  "stuck",
];

export function pickNextTask(tasks: WorkPackage[]): WorkPackage | null {
  const candidates = tasks.filter(
    (t) => t.status !== "done" && !["ready_for_qa", "in_qa"].includes(t.status)
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const sa = NEXT_STATUSES.indexOf(a.status);
    const sb = NEXT_STATUSES.indexOf(b.status);
    const statusRank = (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    if (statusRank !== 0) return statusRank;
    return compareTaskPriority(a, b);
  })[0];
}

export async function getEmployeeTasks(userId: string): Promise<EmployeeTaskBoard> {
  const tasks = await getWorkPackages({ assignedTo: userId });
  return bucketEmployeeTasks(tasks);
}

export async function getEmployeeTaskForUser(
  userId: string,
  taskId: string
): Promise<WorkPackage | null> {
  const tasks = await getWorkPackages({ assignedTo: userId });
  return tasks.find((t) => t.id === taskId) ?? null;
}
