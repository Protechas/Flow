import type { WorkPackage, WorkPriority, WorkStatus } from "@/types/flow";

const PRIORITY_RANK: Record<WorkPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function compareTaskPriority(a: WorkPackage, b: WorkPackage): number {
  const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (pr !== 0) return pr;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.title.localeCompare(b.title);
}

export type EmployeeTaskBucket =
  | "my_tasks"
  | "in_progress"
  | "waiting_qa"
  | "returned"
  | "completed";

export interface EmployeeTaskBoard {
  myTasks: WorkPackage[];
  inProgress: WorkPackage[];
  waitingQa: WorkPackage[];
  returned: WorkPackage[];
  completed: WorkPackage[];
  all: WorkPackage[];
}
