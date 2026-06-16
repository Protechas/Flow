import type { DepartmentUser, Team, User } from "@/types/flow";
import {
  getUserSetupIssues,
  getUserSetupStatus,
  type UserSetupStatus,
} from "./needs-setup";

export type AccountStatus = "active" | "needs_setup";
export type HierarchyStatus = "complete" | "incomplete";

export interface AccountSetupSummary {
  accountStatus: AccountStatus;
  hierarchyStatus: HierarchyStatus;
  setupStatus: UserSetupStatus;
  productionReady: boolean;
  missingFields: string[];
  issues: ReturnType<typeof getUserSetupIssues>;
}

export function getAccountSetupSummary(
  user: User,
  departmentUsers: DepartmentUser[],
  teams: Team[]
): AccountSetupSummary {
  const issues = getUserSetupIssues(user, departmentUsers, teams);
  const setupStatus = getUserSetupStatus(user, departmentUsers, teams);
  const hierarchyStatus: HierarchyStatus =
    setupStatus === "complete" ? "complete" : "incomplete";
  const accountStatus: AccountStatus =
    user.is_active && setupStatus === "complete" ? "active" : "needs_setup";

  return {
    accountStatus,
    hierarchyStatus,
    setupStatus,
    productionReady: user.is_active && setupStatus === "complete",
    missingFields: issues.map((i) => i.message),
    issues,
  };
}

export function isUserProductionReady(
  user: User,
  departmentUsers: DepartmentUser[],
  teams: Team[]
): boolean {
  return getAccountSetupSummary(user, departmentUsers, teams).productionReady;
}

export function listUsersNeedingSetup(
  users: User[],
  departmentUsers: DepartmentUser[],
  teams: Team[]
): User[] {
  return users.filter(
    (u) => getUserSetupStatus(u, departmentUsers, teams) === "needs_setup"
  );
}

/** Safe defaults for newly created accounts — employee with no hierarchy. */
export const NEW_USER_DEFAULTS = {
  role: "employee" as const,
  team_id: null as string | null,
  manager_id: null as string | null,
};

export function assertProductionAssignable(
  assignee: User,
  departmentUsers: DepartmentUser[],
  teams: Team[]
): void {
  if (!isUserProductionReady(assignee, departmentUsers, teams)) {
    throw new Error("ASSIGNEE_SETUP_INCOMPLETE");
  }
}
