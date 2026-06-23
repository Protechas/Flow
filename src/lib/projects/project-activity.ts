import type { ActivityEvent, WorkPackage } from "@/types/flow";

/** Activity events scoped to a project (by work package or summary match). */
export function filterProjectActivity(
  projectId: string,
  packages: WorkPackage[],
  activity: ActivityEvent[],
  projectName?: string
): ActivityEvent[] {
  const packageIds = new Set(packages.filter((p) => p.project_id === projectId).map((p) => p.id));
  const nameLower = projectName?.toLowerCase();

  return activity.filter((event) => {
    if (event.work_package_id && packageIds.has(event.work_package_id)) return true;
    if (nameLower && event.summary.toLowerCase().includes(nameLower)) return true;
    return false;
  });
}
