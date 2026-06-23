import { hasPermission } from "@/lib/auth/permissions";
import type { Project, User, UserRole } from "@/types/flow";

export function canManageProjectMetrics(user: User): boolean {
  return hasPermission(user.role, "projects:edit");
}

export function canUpdateProjectMetricValues(user: User, project: Project): boolean {
  if (hasPermission(user.role, "projects:edit")) return true;
  if (user.role === "teamlead" && project.team_id && user.team_id === project.team_id) {
    return true;
  }
  if (project.project_owner_id === user.id) return true;
  return false;
}

export function canViewProjectMetrics(_user: User): boolean {
  return true;
}

export function metricPermissionHint(role: UserRole): string {
  if (hasPermission(role, "projects:edit")) {
    return "Full metric configuration and value updates.";
  }
  if (role === "teamlead") {
    return "Update metric values on your team projects.";
  }
  return "View project metrics.";
}
