import type { Department, DepartmentUser, Team, User } from "@/types/flow";

export interface DepartmentStructureNode {
  department: Department;
  leadName: string | null;
  teams: TeamStructureNode[];
  memberCount: number;
  vacantLead: boolean;
}

export interface TeamStructureNode {
  team: Team;
  managerName: string | null;
  leadName: string | null;
  memberCount: number;
  vacantManager: boolean;
  vacantLead: boolean;
}

export function userLabel(users: User[], userId: string | null | undefined): string | null {
  if (!userId) return null;
  return users.find((u) => u.id === userId)?.full_name ?? null;
}

export function listUnassignedDepartmentUsers(
  users: User[],
  departmentUsers: DepartmentUser[]
): User[] {
  const assigned = new Set(departmentUsers.map((du) => du.user_id));
  return users.filter((u) => u.is_active && !assigned.has(u.id));
}

export function countVacantDepartmentSlots(
  departments: Department[],
  teams: Team[]
): number {
  let n = 0;
  for (const d of departments) {
    if (d.status === "active" && !d.lead_user_id) n += 1;
  }
  for (const t of teams) {
    if (!t.manager_id) n += 1;
    if (!t.team_lead_user_id) n += 1;
  }
  return n;
}

export function countTeamMembers(
  teamId: string,
  users: User[],
  departmentUsers: DepartmentUser[],
  departmentId: string
): number {
  const fromUsers = users.filter((u) => u.is_active && u.team_id === teamId).length;
  const fromMembership = departmentUsers.filter(
    (du) =>
      du.department_id === departmentId &&
      du.role_in_department === "member" &&
      users.find((u) => u.id === du.user_id)?.team_id === teamId
  ).length;
  return Math.max(fromUsers, fromMembership);
}

export function buildDepartmentStructure(
  departments: Department[],
  teams: Team[],
  users: User[],
  departmentUsers: DepartmentUser[]
): DepartmentStructureNode[] {
  return departments
    .filter((d) => d.status === "active")
    .map((department) => {
      const deptTeams = teams.filter((t) => t.department_id === department.id);
      const memberCount = departmentUsers.filter(
        (du) => du.department_id === department.id
      ).length;
      return {
        department,
        leadName: userLabel(users, department.lead_user_id),
        vacantLead: !department.lead_user_id,
        memberCount,
        teams: deptTeams.map((team) => ({
          team,
          managerName: userLabel(users, team.manager_id),
          leadName: userLabel(users, team.team_lead_user_id),
          vacantManager: !team.manager_id,
          vacantLead: !team.team_lead_user_id,
          memberCount: countTeamMembers(team.id, users, departmentUsers, department.id),
        })),
      };
    });
}
