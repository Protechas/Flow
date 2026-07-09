import { updateWorkPackage } from "@/lib/data/flow-store";
import { listWorkPackages } from "@/lib/data/work-packages";
import { persistWorkPackageDb } from "@/lib/data/work-items-db";

/** One task in progress at a time. When an employee starts (or resumes) a
 * task, any OTHER task of theirs still marked working_on_it returns to
 * "assigned" — it stays startable at the top of Up Next with all files and
 * time intact, but there's never a second hidden "in progress" state.
 * Correction returns (correction_needed) are untouched. */
export async function demoteOtherInProgressTasks(
  userId: string,
  keepTaskId: string
): Promise<void> {
  const others = listWorkPackages({ assignedTo: userId }).filter(
    (p) => p.id !== keepTaskId && p.status === "working_on_it"
  );
  for (const task of others) {
    const updated = updateWorkPackage(task.id, { status: "assigned" });
    if (updated) await persistWorkPackageDb(updated);
  }
}
