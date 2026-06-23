import type {
  Department,
  OrganizationalPosition,
  OrgPosition,
  Team,
  User,
} from "@/types/flow";

export const POSITION_LEVEL_ORDER: Record<OrganizationalPosition, number> = {
  senior_manager: 0,
  manager: 1,
  team_lead: 2,
  employee: 3,
};

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function comparePositions(a: OrgPosition, b: OrgPosition): number {
  const levelA = POSITION_LEVEL_ORDER[a.position_level] ?? 99;
  const levelB = POSITION_LEVEL_ORDER[b.position_level] ?? 99;
  if (levelA !== levelB) return levelA - levelB;
  const titleCmp = compareText(a.title, b.title);
  if (titleCmp !== 0) return titleCmp;
  return compareText(a.id, b.id);
}

export function sortPositions(positions: OrgPosition[]): OrgPosition[] {
  return [...positions].sort(comparePositions);
}

export function sortDepartments(departments: Department[]): Department[] {
  return [...departments].sort(
    (a, b) => compareText(a.name, b.name) || compareText(a.id, b.id)
  );
}

export function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort(
    (a, b) =>
      compareText(a.department_id ?? "", b.department_id ?? "") ||
      compareText(a.name, b.name) ||
      compareText(a.id, b.id)
  );
}

export function sortUsers(users: User[]): User[] {
  return [...users].sort(
    (a, b) =>
      compareText(a.full_name, b.full_name) ||
      compareText(a.email, b.email) ||
      compareText(a.id, b.id)
  );
}
