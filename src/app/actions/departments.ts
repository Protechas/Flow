"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { hasPermission } from "@/lib/auth/permissions";
import { canManageDepartment } from "@/lib/departments/scope";
import { requireUser, requirePermission } from "@/lib/auth/session";
import {
  countProjectsForDepartment,
  createDepartment,
  createTeam,
  getFlowStore,
  initFlowStore,
  listDepartmentUsers,
  listDepartments,
  listTeamsStore,
  removeUserDepartmentMembership,
  setUserDepartmentMembership,
  updateDepartment,
  updateTeam,
} from "@/lib/data/flow-store";
import {
  deleteDepartmentDb,
  deleteTeamDb,
  ensureDepartmentsLoaded,
  insertDepartmentDb,
  insertTeamDb,
  removeDepartmentUserDb,
  updateDepartmentDb,
  updateTeamDb,
  upsertDepartmentUserDb,
} from "@/lib/data/departments-db";
import { updateUserProfile } from "@/lib/data/users";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { DepartmentRoleInDepartment } from "@/types/flow";

function revalidateDeptPaths() {
  revalidatePath("/", "layout");
}

async function persistDepartment(
  id: string,
  updates: Parameters<typeof updateDepartmentDb>[1]
) {
  return isSupabaseConfigured()
    ? await updateDepartmentDb(id, updates)
    : updateDepartment(id, updates);
}

async function persistTeam(id: string, updates: Parameters<typeof updateTeamDb>[1]) {
  return isSupabaseConfigured() ? await updateTeamDb(id, updates) : updateTeam(id, updates);
}

export async function getDepartmentsAction() {
  await requireUser();
  initFlowStore();
  await ensureDepartmentsLoaded();
  return listDepartments();
}

export async function getTeamsAction() {
  await requireUser();
  initFlowStore();
  await ensureDepartmentsLoaded();
  return listTeamsStore();
}

export async function getDepartmentUsersAction() {
  await requireUser();
  initFlowStore();
  await ensureDepartmentsLoaded();
  return listDepartmentUsers();
}

export async function createDepartmentAction(input: {
  name: string;
  description?: string;
  lead_user_id?: string | null;
}) {
  const actor = await requireUser();
  if (!hasPermission(actor.role, "departments:manage")) throw new Error("FORBIDDEN");
  initFlowStore();
  await ensureDepartmentsLoaded();

  const dept = isSupabaseConfigured()
    ? await insertDepartmentDb(input)
    : createDepartment(input);

  if (input.lead_user_id) {
    await upsertDepartmentUserDb(input.lead_user_id, dept.id, {
      is_primary: true,
      role_in_department: "lead",
    });
  }

  await writeAuditLog({
    action: "project_changed",
    entityType: "department",
    entityId: dept.id,
    summary: `Created department ${dept.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return dept;
}

export async function updateDepartmentAction(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    lead_user_id?: string | null;
    status?: "active" | "archived";
  }
) {
  const actor = await requireUser();
  if (!hasPermission(actor.role, "departments:manage") && !canManageDepartment(actor, id)) {
    throw new Error("FORBIDDEN");
  }
  initFlowStore();

  const dept = await persistDepartment(id, updates);
  if (!dept) throw new Error("Department not found");

  await writeAuditLog({
    action: "project_changed",
    entityType: "department",
    entityId: id,
    summary: `Updated department ${dept.name}`,
    metadata: updates,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return dept;
}

export async function createTeamAction(input: {
  name: string;
  description?: string | null;
  department_id: string;
  manager_id?: string | null;
  team_lead_user_id?: string | null;
}) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();

  const team = isSupabaseConfigured()
    ? await insertTeamDb(input)
    : createTeam(input);

  await writeAuditLog({
    action: "team_changed",
    entityType: "team",
    entityId: team.id,
    summary: `Created team ${team.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return team;
}

export async function updateTeamAction(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    department_id?: string | null;
    manager_id?: string | null;
    team_lead_user_id?: string | null;
  }
) {
  const actor = await requireUser();
  const team = listTeamsStore().find((t) => t.id === id);
  if (!team) throw new Error("Team not found");
  if (
    !hasPermission(actor.role, "departments:manage") &&
    !(team.department_id && canManageDepartment(actor, team.department_id))
  ) {
    throw new Error("FORBIDDEN");
  }
  initFlowStore();

  const updated = await persistTeam(id, updates);
  if (!updated) throw new Error("Team not found");

  await writeAuditLog({
    action: "team_changed",
    entityType: "team",
    entityId: id,
    summary: `Updated team ${updated.name}`,
    metadata: updates,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return updated;
}

export async function assignDepartmentLeadAction(departmentId: string, userId: string | null) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();

  await persistDepartment(departmentId, { lead_user_id: userId });
  if (userId) {
    await upsertDepartmentUserDb(userId, departmentId, {
      is_primary: true,
      role_in_department: "lead",
    });
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "department",
    entityId: departmentId,
    summary: userId ? `Assigned department lead` : `Cleared department lead`,
    metadata: { user_id: userId },
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const };
}

export async function assignTeamLeadAction(teamId: string, userId: string | null) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();
  const team = listTeamsStore().find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found");

  await persistTeam(teamId, { team_lead_user_id: userId });
  if (userId && team.department_id) {
    await upsertDepartmentUserDb(userId, team.department_id, {
      is_primary: true,
      role_in_department: "lead",
    });
    await updateUserProfile(userId, {
      team_id: teamId,
      manager_id: team.manager_id ?? undefined,
      role: "teamlead",
    });
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "team",
    entityId: teamId,
    summary: userId ? `Assigned team lead` : `Cleared team lead`,
    metadata: { user_id: userId },
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const };
}

export async function assignTeamManagerAction(teamId: string, userId: string | null) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();

  await persistTeam(teamId, { manager_id: userId });
  const team = listTeamsStore().find((t) => t.id === teamId);
  if (userId && team?.department_id) {
    await upsertDepartmentUserDb(userId, team.department_id, {
      is_primary: true,
      role_in_department: "manager",
    });
    await updateUserProfile(userId, { role: "manager" });
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "team",
    entityId: teamId,
    summary: userId ? `Assigned team manager` : `Cleared team manager`,
    metadata: { user_id: userId },
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const };
}

export async function assignUserToDepartmentTeamAction(input: {
  userId: string;
  departmentId: string;
  teamId?: string | null;
  role_in_department?: DepartmentRoleInDepartment;
  manager_id?: string | null;
}) {
  const actor = await requireUser();
  if (
    !hasPermission(actor.role, "users:manage") &&
    !canManageDepartment(actor, input.departmentId)
  ) {
    throw new Error("FORBIDDEN");
  }
  initFlowStore();

  await upsertDepartmentUserDb(input.userId, input.departmentId, {
    is_primary: true,
    role_in_department: input.role_in_department ?? "member",
  });

  if (input.teamId) {
    const team = listTeamsStore().find((t) => t.id === input.teamId);
    await updateUserProfile(input.userId, {
      team_id: input.teamId,
      manager_id: input.manager_id ?? team?.team_lead_user_id ?? team?.manager_id ?? null,
      ...(input.role_in_department === "lead" ? { role: "teamlead" as const } : {}),
    });
  }

  await writeAuditLog({
    action: "team_changed",
    entityType: "department_user",
    entityId: input.userId,
    summary: `Assigned user to department`,
    metadata: input,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const };
}

export async function setUserDepartmentAction(
  userId: string,
  departmentId: string,
  opts: { is_primary?: boolean; role_in_department?: DepartmentRoleInDepartment }
) {
  const actor = await requireUser();
  if (!hasPermission(actor.role, "users:manage") && !canManageDepartment(actor, departmentId)) {
    throw new Error("FORBIDDEN");
  }
  initFlowStore();
  const membership = isSupabaseConfigured()
    ? await upsertDepartmentUserDb(userId, departmentId, opts)
    : setUserDepartmentMembership(userId, departmentId, opts);

  await writeAuditLog({
    action: "team_changed",
    entityType: "department_user",
    entityId: membership.id,
    summary: `Updated department membership for user ${userId}`,
    metadata: { departmentId, ...opts },
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return membership;
}

export async function removeUserDepartmentAction(userId: string, departmentId: string) {
  const actor = await requirePermission("users:manage");
  initFlowStore();
  await removeDepartmentUserDb(userId, departmentId);
  revalidateDeptPaths();
  return { ok: true as const };
}

export async function completeDepartmentStructureAction(input: {
  name: string;
  purpose?: string;
  lead_user_id?: string | null;
  teams: { name: string; manager_id?: string | null; team_lead_user_id?: string | null }[];
}) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();

  if (!input.name.trim()) throw new Error("Department name is required.");

  const dept = isSupabaseConfigured()
    ? await insertDepartmentDb({
        name: input.name.trim(),
        description: input.purpose?.trim() || null,
        lead_user_id: input.lead_user_id ?? null,
      })
    : createDepartment({
        name: input.name.trim(),
        description: input.purpose?.trim() || null,
        lead_user_id: input.lead_user_id ?? null,
      });

  if (input.lead_user_id) {
    await upsertDepartmentUserDb(input.lead_user_id, dept.id, {
      is_primary: true,
      role_in_department: "lead",
    });
  }

  for (const teamDef of input.teams) {
    if (!teamDef.name.trim()) continue;
    const team = isSupabaseConfigured()
      ? await insertTeamDb({
          name: teamDef.name.trim(),
          department_id: dept.id,
          manager_id: teamDef.manager_id ?? null,
          team_lead_user_id: teamDef.team_lead_user_id ?? null,
        })
      : createTeam({
          name: teamDef.name.trim(),
          department_id: dept.id,
          manager_id: teamDef.manager_id ?? null,
          team_lead_user_id: teamDef.team_lead_user_id ?? null,
        });

    if (teamDef.manager_id) {
      await upsertDepartmentUserDb(teamDef.manager_id, dept.id, {
        is_primary: true,
        role_in_department: "manager",
      });
    }
    if (teamDef.team_lead_user_id) {
      await upsertDepartmentUserDb(teamDef.team_lead_user_id, dept.id, {
        is_primary: true,
        role_in_department: "lead",
      });
      await updateUserProfile(teamDef.team_lead_user_id, {
        team_id: team.id,
        manager_id: teamDef.manager_id ?? null,
        role: "teamlead",
      });
    }
  }

  await writeAuditLog({
    action: "project_changed",
    entityType: "department",
    entityId: dept.id,
    summary: `Built department structure: ${dept.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const, departmentId: dept.id };
}

export async function deleteTeamAction(teamId: string) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();

  const team = listTeamsStore().find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found.");

  await deleteTeamDb(teamId);

  await writeAuditLog({
    action: "team_changed",
    entityType: "team",
    entityId: teamId,
    summary: `Deleted team ${team.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const };
}

export async function deleteDepartmentAction(departmentId: string) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();

  const department = listDepartments().find((d) => d.id === departmentId);
  if (!department) throw new Error("Department not found.");

  const projectCount = countProjectsForDepartment(departmentId);
  if (projectCount > 0) {
    throw new Error(
      `Cannot delete "${department.name}" — ${projectCount} active project(s) are assigned to it. Archive or reassign those projects first.`
    );
  }

  await deleteDepartmentDb(departmentId);

  await writeAuditLog({
    action: "project_changed",
    entityType: "department",
    entityId: departmentId,
    summary: `Deleted department ${department.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  revalidateDeptPaths();
  return { ok: true as const };
}
