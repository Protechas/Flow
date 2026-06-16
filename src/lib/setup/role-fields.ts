import type { Department, Team, User, UserRole } from "@/types/flow";

export type SetupField =
  | "department"
  | "team"
  | "reports_to"
  | "senior_manager";

export interface RoleFieldConfig {
  fields: SetupField[];
  requiresReportsTo: boolean;
  requiresDepartment: boolean;
  requiresTeam: boolean;
  requiresSeniorManager: boolean;
  helper: string;
}

const ROLE_CONFIG: Record<UserRole, RoleFieldConfig> = {
  super_admin: {
    fields: [],
    requiresReportsTo: false,
    requiresDepartment: false,
    requiresTeam: false,
    requiresSeniorManager: false,
    helper: "Full platform access across all departments and branches.",
  },
  admin: {
    fields: [],
    requiresReportsTo: false,
    requiresDepartment: false,
    requiresTeam: false,
    requiresSeniorManager: false,
    helper: "Global access to manage users, departments, and operations.",
  },
  senior_manager: {
    fields: ["department"],
    requiresReportsTo: false,
    requiresDepartment: true,
    requiresTeam: false,
    requiresSeniorManager: false,
    helper: "Leads a department branch. Reports to admin optionally.",
  },
  manager: {
    fields: ["department", "reports_to"],
    requiresReportsTo: true,
    requiresDepartment: true,
    requiresTeam: false,
    requiresSeniorManager: true,
    helper: "Manages team leads and employees within a department branch.",
  },
  teamlead: {
    fields: ["department", "reports_to"],
    requiresReportsTo: true,
    requiresDepartment: true,
    requiresTeam: false,
    requiresSeniorManager: false,
    helper: "Leads a team. Must report to a manager.",
  },
  employee: {
    fields: ["department", "team", "reports_to"],
    requiresReportsTo: true,
    requiresDepartment: true,
    requiresTeam: true,
    requiresSeniorManager: false,
    helper: "Assigned to a team with a direct supervisor (team lead or manager).",
  },
  viewer: {
    fields: [],
    requiresReportsTo: false,
    requiresDepartment: false,
    requiresTeam: false,
    requiresSeniorManager: false,
    helper: "Read-only visibility across the organization.",
  },
};

export function getRoleFieldConfig(role: UserRole): RoleFieldConfig {
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;
}

/** Valid supervisor roles for each role's "Reports To" field */
export function getValidSupervisorRoles(role: UserRole): UserRole[] {
  switch (role) {
    case "employee":
      return ["teamlead", "manager"];
    case "teamlead":
      return ["manager"];
    case "manager":
      return ["senior_manager"];
    case "senior_manager":
      return ["admin", "super_admin"];
    default:
      return [];
  }
}

export function filterValidSupervisors(
  role: UserRole,
  users: User[]
): User[] {
  const allowedRoles = new Set(getValidSupervisorRoles(role));
  if (!allowedRoles.size) return [];
  return users.filter((u) => u.is_active && allowedRoles.has(u.role));
}

export function teamsForDepartment(teams: Team[], departmentId: string): Team[] {
  return teams.filter((t) => t.department_id === departmentId || !t.department_id);
}

export function departmentLabel(departments: Department[], id: string | null | undefined): string {
  if (!id) return "—";
  return departments.find((d) => d.id === id)?.name ?? "—";
}

export function teamLabel(teams: Team[], id: string | null | undefined): string {
  if (!id) return "—";
  return teams.find((t) => t.id === id)?.name ?? "—";
}

export function userLabel(users: User[], id: string | null | undefined): string {
  if (!id) return "—";
  return users.find((u) => u.id === id)?.full_name ?? "—";
}
