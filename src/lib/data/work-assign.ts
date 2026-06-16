import type { WorkPackage, WorkStatus, YearWorkItem } from "@/types/flow";

/** Single rule for all assignment paths (board, bulk, year, create). */
export function assignmentUpdates(
  assigneeId: string | null,
  currentStatus: WorkStatus
): Partial<WorkPackage> {
  const updates: Partial<WorkPackage> = { assigned_to: assigneeId };
  if (assigneeId && currentStatus === "not_started") {
    updates.status = "assigned";
  }
  if (!assigneeId && currentStatus === "assigned") {
    updates.status = "not_started";
  }
  return updates;
}

export function defaultPackageTitle(year: YearWorkItem, manufacturerName?: string | null): string {
  const mfr = manufacturerName?.trim() || "Work";
  return `${mfr} ${year.year}`;
}
