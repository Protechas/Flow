import { resolveWorkPackageTrackingFlags } from "@/lib/work-packages/tracking-flags";
import type { TaskFileUpload, WorkPackage } from "@/types/flow";

/**
 * Upload gate: a task built with "files required" must have at least one
 * file uploaded by the analyst on any day they put timer work into it —
 * otherwise end-of-day clock-out is blocked, same as a missing wrap-up.
 * Owner rule (July 16): applies per task flag, not per person.
 */
export interface UploadGateViolation {
  taskId: string;
  taskTitle: string;
}

/** Pure core — inputs are already scoped to the user and the day. */
export function findUploadGateViolations(input: {
  userId: string;
  /** Tasks the user ran a task timer on today */
  timedTaskIds: string[];
  tasks: WorkPackage[];
  /** All uploads recorded today (any user — filtered internally) */
  uploadsToday: Pick<TaskFileUpload, "task_id" | "user_id">[];
}): UploadGateViolation[] {
  const uploadedTaskIds = new Set(
    input.uploadsToday.filter((u) => u.user_id === input.userId).map((u) => u.task_id)
  );
  const seen = new Set<string>();
  const violations: UploadGateViolation[] = [];

  for (const taskId of input.timedTaskIds) {
    if (seen.has(taskId)) continue;
    seen.add(taskId);
    const task = input.tasks.find((t) => t.id === taskId);
    if (!task) continue;
    // A done task already passed its own submission requirements.
    if (task.status === "done") continue;
    if (!resolveWorkPackageTrackingFlags(task).filesRequired) continue;
    if (uploadedTaskIds.has(taskId)) continue;
    violations.push({ taskId, taskTitle: task.title });
  }

  return violations;
}
