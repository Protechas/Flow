import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createDepartment,
  createTeam,
  initFlowStore,
  listDepartmentUsers,
  listDepartments,
  listTeamsStore,
  replaceDepartmentStructureStore,
  updateDepartment,
  updateTeam,
} from "@/lib/data/flow-store";
import type { Department, DepartmentUser, Team } from "@/types/flow";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") return true;
  const msg = error.message ?? "";
  return msg.includes("departments") || msg.includes("department_users") || msg.includes("teams");
}

function mapDepartment(row: Record<string, unknown>): Department {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    lead_user_id: row.lead_user_id ? String(row.lead_user_id) : null,
    status: (row.status as Department["status"]) ?? "active",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapTeam(row: Record<string, unknown>): Team {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    // Missing column (migration not applied) reads as production — safe default.
    is_production: row.is_production == null ? true : Boolean(row.is_production),
    department_id: row.department_id ? String(row.department_id) : null,
    manager_id: row.manager_id ? String(row.manager_id) : null,
    team_lead_user_id: row.team_lead_user_id ? String(row.team_lead_user_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapDepartmentUser(row: Record<string, unknown>): DepartmentUser {
  return {
    id: String(row.id),
    department_id: String(row.department_id),
    user_id: String(row.user_id),
    role_in_department: row.role_in_department as DepartmentUser["role_in_department"],
    is_primary: Boolean(row.is_primary),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

export async function hydrateDepartmentStructure(): Promise<{
  departments: Department[];
  teams: Team[];
  departmentUsers: DepartmentUser[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      departments: listDepartments(),
      teams: listTeamsStore(),
      departmentUsers: listDepartmentUsers(),
    };
  }

  const client = await dbClient();
  const [deptRes, teamRes, duRes] = await Promise.all([
    client.from("departments").select("*").order("name"),
    client.from("teams").select("*").order("name"),
    client.from("department_users").select("*"),
  ]);

  if (deptRes.error && !isUnavailable(deptRes.error)) throw deptRes.error;
  if (teamRes.error && !isUnavailable(teamRes.error)) throw teamRes.error;
  if (duRes.error && !isUnavailable(duRes.error)) throw duRes.error;

  const departments = (deptRes.data ?? []).map((r) => mapDepartment(r as Record<string, unknown>));
  const teams = (teamRes.data ?? []).map((r) => mapTeam(r as Record<string, unknown>));
  const departmentUsers = (duRes.data ?? []).map((r) =>
    mapDepartmentUser(r as Record<string, unknown>)
  );

  replaceDepartmentStructureStore(departments, teams, departmentUsers);
  return { departments, teams, departmentUsers };
}

export const ensureDepartmentsLoaded = cache(async (): Promise<{
  departments: Department[];
  teams: Team[];
  departmentUsers: DepartmentUser[];
}> => {
  initFlowStore();
  if (!isSupabaseConfigured()) {
    return {
      departments: listDepartments(),
      teams: listTeamsStore(),
      departmentUsers: listDepartmentUsers(),
    };
  }
  return hydrateDepartmentStructure();
});

export async function insertDepartmentDb(input: {
  name: string;
  description?: string | null;
  lead_user_id?: string | null;
}): Promise<Department> {
  if (!isSupabaseConfigured()) return createDepartment(input);

  const client = await dbClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("departments")
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      lead_user_id: input.lead_user_id ?? null,
      status: "active",
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    if (isUnavailable(error)) return createDepartment(input);
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }

  const dept = mapDepartment(data as Record<string, unknown>);
  replaceDepartmentStructureStore(
    [dept, ...listDepartments()],
    listTeamsStore(),
    listDepartmentUsers()
  );
  return dept;
}

export async function updateDepartmentDb(
  id: string,
  updates: Partial<Pick<Department, "name" | "description" | "lead_user_id" | "status">>
): Promise<Department | null> {
  if (!isSupabaseConfigured()) return updateDepartment(id, updates);

  const client = await dbClient();
  const payload = {
    ...updates,
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("departments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (isUnavailable(error)) return updateDepartment(id, updates);
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
  if (!data) return null;

  const dept = mapDepartment(data as Record<string, unknown>);
  replaceDepartmentStructureStore(
    listDepartments().map((d) => (d.id === id ? dept : d)),
    listTeamsStore(),
    listDepartmentUsers()
  );
  return dept;
}

export async function insertTeamDb(input: {
  name: string;
  description?: string | null;
  department_id?: string | null;
  manager_id?: string | null;
  team_lead_user_id?: string | null;
}): Promise<Team> {
  if (!isSupabaseConfigured()) return createTeam(input);

  const client = await dbClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("teams")
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      department_id: input.department_id ?? null,
      manager_id: input.manager_id ?? null,
      team_lead_user_id: input.team_lead_user_id ?? null,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    if (isUnavailable(error)) return createTeam(input);
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }

  const team = mapTeam(data as Record<string, unknown>);
  replaceDepartmentStructureStore(listDepartments(), [team, ...listTeamsStore()], listDepartmentUsers());
  return team;
}

export async function updateTeamDb(
  id: string,
  updates: Partial<
    Pick<Team, "name" | "description" | "department_id" | "manager_id" | "team_lead_user_id" | "is_production">
  >
): Promise<Team | null> {
  if (!isSupabaseConfigured()) return updateTeam(id, updates);

  const client = await dbClient();
  const payload = {
    ...updates,
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("teams").update(payload).eq("id", id).select().single();

  if (error) {
    if (isUnavailable(error)) return updateTeam(id, updates);
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
  if (!data) return null;

  const team = mapTeam(data as Record<string, unknown>);
  replaceDepartmentStructureStore(
    listDepartments(),
    listTeamsStore().map((t) => (t.id === id ? team : t)),
    listDepartmentUsers()
  );
  return team;
}

export async function upsertDepartmentUserDb(
  userId: string,
  departmentId: string,
  opts: {
    is_primary?: boolean;
    role_in_department?: DepartmentUser["role_in_department"];
  }
): Promise<DepartmentUser> {
  const { setUserDepartmentMembership } = await import("@/lib/data/flow-store");
  if (!isSupabaseConfigured()) {
    return setUserDepartmentMembership(userId, departmentId, opts);
  }

  const client = await dbClient();
  const existing = listDepartmentUsers().find(
    (du) => du.user_id === userId && du.department_id === departmentId
  );
  const now = new Date().toISOString();
  const payload = {
    department_id: departmentId,
    user_id: userId,
    role_in_department: opts.role_in_department ?? existing?.role_in_department ?? "member",
    is_primary: opts.is_primary ?? existing?.is_primary ?? true,
    updated_at: now,
  };

  const { data, error } = existing
    ? await client.from("department_users").update(payload).eq("id", existing.id).select().single()
    : await client.from("department_users").insert(payload).select().single();

  if (error) {
    if (isUnavailable(error)) return setUserDepartmentMembership(userId, departmentId, opts);
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }

  const entry = mapDepartmentUser(data as Record<string, unknown>);
  const others = listDepartmentUsers().filter((du) => du.id !== entry.id);
  if (entry.is_primary) {
    for (const du of others) {
      if (du.user_id === userId && du.is_primary) du.is_primary = false;
    }
  }
  replaceDepartmentStructureStore(listDepartments(), listTeamsStore(), [...others, entry]);
  return entry;
}

export async function removeDepartmentUserDb(userId: string, departmentId: string): Promise<void> {
  const { removeUserDepartmentMembership } = await import("@/lib/data/flow-store");
  if (!isSupabaseConfigured()) {
    removeUserDepartmentMembership(userId, departmentId);
    return;
  }

  const client = await dbClient();
  const { error } = await client
    .from("department_users")
    .delete()
    .eq("user_id", userId)
    .eq("department_id", departmentId);

  if (error && !isUnavailable(error)) {
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
  removeUserDepartmentMembership(userId, departmentId);
}

export async function deleteTeamDb(teamId: string): Promise<void> {
  const { deleteTeam } = await import("@/lib/data/flow-store");
  if (!isSupabaseConfigured()) {
    deleteTeam(teamId);
    return;
  }

  const client = await dbClient();
  const { error: userError } = await client
    .from("users")
    .update({ team_id: null, updated_at: new Date().toISOString() })
    .eq("team_id", teamId);
  if (userError && !isUnavailable(userError)) {
    throw new Error(userError.hint ? `${userError.message} (${userError.hint})` : userError.message);
  }

  const { error } = await client.from("teams").delete().eq("id", teamId);
  if (error) {
    if (isUnavailable(error)) {
      deleteTeam(teamId);
      return;
    }
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
  deleteTeam(teamId);
}

export async function deleteDepartmentDb(departmentId: string): Promise<void> {
  const { deleteDepartment, listTeamsStore } = await import("@/lib/data/flow-store");
  if (!isSupabaseConfigured()) {
    deleteDepartment(departmentId);
    return;
  }

  const client = await dbClient();
  const teamIds = listTeamsStore()
    .filter((t) => t.department_id === departmentId)
    .map((t) => t.id);

  if (teamIds.length > 0) {
    const { error: userError } = await client
      .from("users")
      .update({ team_id: null, updated_at: new Date().toISOString() })
      .in("team_id", teamIds);
    if (userError && !isUnavailable(userError)) {
      throw new Error(userError.hint ? `${userError.message} (${userError.hint})` : userError.message);
    }

    const { error: teamError } = await client.from("teams").delete().eq("department_id", departmentId);
    if (teamError && !isUnavailable(teamError)) {
      throw new Error(teamError.hint ? `${teamError.message} (${teamError.hint})` : teamError.message);
    }
  }

  const { error: duError } = await client
    .from("department_users")
    .delete()
    .eq("department_id", departmentId);
  if (duError && !isUnavailable(duError)) {
    throw new Error(duError.hint ? `${duError.message} (${duError.hint})` : duError.message);
  }

  const { error } = await client.from("departments").delete().eq("id", departmentId);
  if (error) {
    if (isUnavailable(error)) {
      deleteDepartment(departmentId);
      return;
    }
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
  deleteDepartment(departmentId);
}
