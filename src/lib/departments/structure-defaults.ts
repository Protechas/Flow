import { DEFAULT_DEPARTMENT_ID } from "@/lib/data/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isPersistedUuid, persistedUuidOrNull } from "@/lib/server/persisted-id";
import type { Department, Team } from "@/types/flow";

/** Demo-only structure ids that must not reach Supabase FK columns. */
export const DEMO_STRUCTURE_IDS = new Set([
  DEFAULT_DEPARTMENT_ID,
  "dept-adas",
  "team-1",
  "team-2",
  "team-adas",
]);

export function isDemoStructureId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (isPersistedUuid(id)) return false;
  return DEMO_STRUCTURE_IDS.has(id) || !isPersistedUuid(id);
}

export function resolvePersistedTeamId(
  preferredTeamId: string | null | undefined,
  teams: Team[]
): string | null {
  const direct = persistedUuidOrNull(preferredTeamId);
  if (direct && teams.some((t) => t.id === direct)) return direct;
  return null;
}

export function resolvePersistedDepartmentId(
  preferredDepartmentId: string | null | undefined,
  departments: Department[]
): string | null {
  const direct = persistedUuidOrNull(preferredDepartmentId);
  if (direct && departments.some((d) => d.id === direct)) return direct;
  return null;
}

export function teamIdForPersistedDepartment(
  departmentId: string | null,
  teams: Team[]
): string | null {
  if (!departmentId) return null;
  const match = teams.find(
    (t) => t.department_id === departmentId && isPersistedUuid(t.id)
  );
  if (match) return match.id;
  if (!isSupabaseConfigured()) {
    return teams.find((t) => t.department_id === departmentId)?.id ?? null;
  }
  return teams.find((t) => isPersistedUuid(t.id))?.id ?? null;
}

export function departmentIdForPersistedTeam(
  teamId: string | null,
  teams: Team[]
): string | null {
  if (!teamId) return null;
  const team = teams.find((t) => t.id === teamId);
  return persistedUuidOrNull(team?.department_id ?? null);
}

export interface ProjectStructureDefaults {
  department_id: string | null;
  team_id: string | null;
}

/** Resolve department/team for new projects without leaking demo ids into production. */
export function resolveProjectStructureDefaults(input: {
  department_id?: string | null;
  team_id?: string | null;
  departments: Department[];
  teams: Team[];
}): ProjectStructureDefaults {
  const { departments, teams } = input;

  let teamId =
    resolvePersistedTeamId(input.team_id, teams) ??
    (isSupabaseConfigured() ? null : input.team_id ?? null);

  let departmentId =
    resolvePersistedDepartmentId(input.department_id, departments) ??
    departmentIdForPersistedTeam(teamId, teams);

  if (!teamId && departmentId) {
    teamId = teamIdForPersistedDepartment(departmentId, teams);
  }

  if (!departmentId && teamId) {
    departmentId = departmentIdForPersistedTeam(teamId, teams);
  }

  if (!teamId && !departmentId) {
    if (isSupabaseConfigured()) {
      const firstDept = departments.find((d) => isPersistedUuid(d.id));
      departmentId = firstDept?.id ?? null;
      teamId = teamIdForPersistedDepartment(departmentId, teams);
    } else {
      teamId = teams[0]?.id ?? "team-1";
      departmentId =
        departments.find((d) => d.id === teams[0]?.department_id)?.id ??
        DEFAULT_DEPARTMENT_ID;
    }
  }

  if (isSupabaseConfigured()) {
    return {
      department_id: persistedUuidOrNull(departmentId),
      team_id: persistedUuidOrNull(teamId),
    };
  }

  return {
    department_id: departmentId,
    team_id: teamId,
  };
}

/** Client/server helper — never fall back to demo team ids in production. */
export function resolveTeamIdForDepartment(
  departmentId: string,
  teams: Team[]
): string {
  const resolved = teamIdForPersistedDepartment(
    persistedUuidOrNull(departmentId) ?? (isSupabaseConfigured() ? null : departmentId),
    teams
  );
  if (resolved) return resolved;
  if (!isSupabaseConfigured()) return teams[0]?.id ?? "team-1";
  return teams.find((t) => isPersistedUuid(t.id))?.id ?? "";
}
