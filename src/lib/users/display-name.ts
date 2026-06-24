import type { Department, Manufacturer, Project, Team, User } from "@/types/flow";

const NONE_VALUES = new Set(["__none__", "__all__", ""]);

/** Resolve a stored id to a display label from a list of entities. */
export function resolveEntityLabel<T extends { id: string }>(
  id: string | null | undefined,
  items: T[],
  getLabel: (item: T) => string,
  fallback: string
): string {
  if (!id || NONE_VALUES.has(id)) return fallback;
  const match = items.find((item) => item.id === id);
  return match ? getLabel(match) : fallback;
}

/** Human-readable label for roster / select display. */
export function userDisplayName(user: Pick<User, "full_name" | "email">): string {
  const name = user.full_name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Unnamed user";
}

export function resolveUserLabel(
  userId: string | null | undefined,
  users: User[],
  fallback = "Unassigned"
): string {
  return resolveEntityLabel(userId, users, userDisplayName, fallback);
}

export function resolveDepartmentLabel(
  departmentId: string | null | undefined,
  departments: Department[],
  fallback = "Select department"
): string {
  return resolveEntityLabel(
    departmentId,
    departments,
    (d) => d.name,
    fallback
  );
}

export function resolveProjectLabel(
  projectId: string | null | undefined,
  projects: Pick<Project, "id" | "name">[],
  fallback = "Select project"
): string {
  return resolveEntityLabel(
    projectId,
    projects,
    (p) => p.name,
    fallback
  );
}

export function resolveTeamLabel(
  teamId: string | null | undefined,
  teams: Pick<Team, "id" | "name">[],
  fallback = "Select team"
): string {
  return resolveEntityLabel(teamId, teams, (t) => t.name, fallback);
}

export function resolveManufacturerLabel(
  manufacturerId: string | null | undefined,
  manufacturers: Pick<Manufacturer, "id" | "name">[],
  fallback = "Select manufacturer"
): string {
  return resolveEntityLabel(
    manufacturerId,
    manufacturers,
    (m) => m.name,
    fallback
  );
}
