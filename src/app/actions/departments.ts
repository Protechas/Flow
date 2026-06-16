"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { hasPermission } from "@/lib/auth/permissions";
import { canManageDepartment } from "@/lib/departments/scope";
import { requireUser } from "@/lib/auth/session";
import {
  createDepartment,
  listDepartments,
  listDepartmentUsers,
  listTeamsStore,
  removeUserDepartmentMembership,
  setUserDepartmentMembership,
  updateDepartment,
} from "@/lib/data/flow-store";
import type { DepartmentRoleInDepartment, DepartmentUser } from "@/types/flow";

function revalidateDeptPaths() {
  revalidatePath("/", "layout");
}

export async function getDepartmentsAction() {
  await requireUser();
  return listDepartments();
}

export async function getTeamsAction() {
  await requireUser();
  return listTeamsStore();
}

export async function getDepartmentUsersAction() {
  await requireUser();
  return listDepartmentUsers();
}

export async function createDepartmentAction(input: {
  name: string;
  description?: string;
  lead_user_id?: string | null;
}) {
  const actor = await requireUser();
  if (!hasPermission(actor.role, "departments:manage")) throw new Error("FORBIDDEN");
  const dept = createDepartment(input);
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
  const dept = updateDepartment(id, updates);
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

export async function setUserDepartmentAction(
  userId: string,
  departmentId: string,
  opts: { is_primary?: boolean; role_in_department?: DepartmentRoleInDepartment }
) {
  const actor = await requireUser();
  if (!hasPermission(actor.role, "users:manage") && !canManageDepartment(actor, departmentId)) {
    throw new Error("FORBIDDEN");
  }
  const membership = setUserDepartmentMembership(userId, departmentId, opts);
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
  const actor = await requireUser();
  if (!hasPermission(actor.role, "users:manage")) throw new Error("FORBIDDEN");
  removeUserDepartmentMembership(userId, departmentId);
  revalidateDeptPaths();
  return { ok: true as const };
}
