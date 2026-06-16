import { getRoleFieldConfig } from "@/lib/setup/role-fields";
import type { DepartmentUser, Team, User } from "@/types/flow";

export type UserSetupStatus = "complete" | "needs_setup";

export interface UserSetupIssue {
  field: string;
  message: string;
}

export function getUserSetupIssues(
  user: User,
  departmentUsers: DepartmentUser[],
  teams: Team[]
): UserSetupIssue[] {
  const issues: UserSetupIssue[] = [];
  const config = getRoleFieldConfig(user.role);

  if (["admin", "super_admin", "viewer"].includes(user.role)) {
    return issues;
  }

  const hasPrimaryDept = departmentUsers.some(
    (du) => du.user_id === user.id && du.is_primary
  );
  const teamDept = user.team_id
    ? teams.find((t) => t.id === user.team_id)?.department_id
    : null;

  if (config.requiresDepartment && !hasPrimaryDept && !teamDept) {
    issues.push({
      field: "department",
      message: "No department assigned",
    });
  }

  if (config.requiresTeam && !user.team_id) {
    issues.push({
      field: "team",
      message: "No team assigned",
    });
  }

  if (config.requiresReportsTo && !user.manager_id) {
    issues.push({
      field: "reports_to",
      message: "No supervisor assigned",
    });
  }

  return issues;
}

export function getUserSetupStatus(
  user: User,
  departmentUsers: DepartmentUser[],
  teams: Team[]
): UserSetupStatus {
  return getUserSetupIssues(user, departmentUsers, teams).length > 0
    ? "needs_setup"
    : "complete";
}
