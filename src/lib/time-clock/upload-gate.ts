import { resolveWorkPackageTrackingFlags } from "@/lib/work-packages/tracking-flags";
import type { ResolvedUploadGate } from "@/lib/operating-models/types";
import type { TaskFileUpload, WorkPackage } from "@/types/flow";

/**
 * Upload gate: a task built with "files required" must have at least one file
 * uploaded by the analyst on a day they put real timer work into it —
 * otherwise end-of-day clock-out is blocked, same as a missing wrap-up.
 *
 * "Real work" is per-team configurable via the operating model: the gate can
 * be turned off entirely, and a minutes threshold keeps a task someone merely
 * opened (then went to a meeting or break) from trapping clock-out.
 */
export interface UploadGateViolation {
  taskId: string;
  taskTitle: string;
}

/** Pure core — inputs are already scoped to the user and the day. */
export function findUploadGateViolations(input: {
  userId: string;
  /** Minutes the user ran a task timer on each task today, keyed by task id. */
  timedMinutesByTask: Record<string, number>;
  tasks: WorkPackage[];
  /** All uploads recorded today (any user — filtered internally) */
  uploadsToday: Pick<TaskFileUpload, "task_id" | "user_id">[];
  /** Per-task gate settings from the owning team's operating model. */
  resolveGate: (task: WorkPackage) => ResolvedUploadGate;
}): UploadGateViolation[] {
  const uploadedTaskIds = new Set(
    input.uploadsToday.filter((u) => u.user_id === input.userId).map((u) => u.task_id)
  );
  const violations: UploadGateViolation[] = [];

  for (const [taskId, minutes] of Object.entries(input.timedMinutesByTask)) {
    const task = input.tasks.find((t) => t.id === taskId);
    if (!task) continue;
    // A done task already passed its own submission requirements.
    if (task.status === "done") continue;
    if (!resolveWorkPackageTrackingFlags(task).filesRequired) continue;

    const gate = input.resolveGate(task);
    if (!gate.enabled) continue;
    // Below the team's threshold — treated as "opened it, didn't really work it."
    if (minutes < gate.minTimedMinutes) continue;

    if (uploadedTaskIds.has(taskId)) continue;
    violations.push({ taskId, taskTitle: task.title });
  }

  return violations;
}
