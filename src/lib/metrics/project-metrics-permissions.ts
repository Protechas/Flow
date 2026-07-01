import { hasPermission } from "@/lib/auth/permissions";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import type { Project, User, UserRole } from "@/types/flow";

export function canManageProjectMetrics(user: User): boolean {
  return hasPermission(getEffectivePermissionRole(user), "projects:edit");
}

export function canUpdateProjectMetricValues(user: User, project: Project): boolean {
  const role = getEffectivePermissionRole(user);
  if (hasPermission(role, "projects:edit")) return true;
  if (user.role === "teamlead" && project.team_id && user.team_id === project.team_id) {
    return true;
  }
  if (project.project_owner_id === user.id) return true;
  return false;
}

export function canViewProjectMetrics(user: User, project: Project): boolean {
  if (canUpdateProjectMetricValues(user, project)) return true;
  if (canManageProjectMetrics(user)) return true;
  const role = getEffectivePermissionRole(user);
  if (hasPermission(role, "reports:view_all")) return true;
  if (hasPermission(role, "work:view_all")) return true;
  if (project.project_owner_id === user.id) return true;
  return false;
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
