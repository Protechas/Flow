"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { syncHierarchyOnManagerChange } from "@/lib/hierarchy/resolver";
import {
  createDepartment,
  createTeam,
  getFlowStore,
  initFlowStore,
} from "@/lib/data/flow-store";
import {
  createUserManuallyAction,
  updateUserDetailsAction,
  updateUserRoleAction,
} from "@/app/actions/users";
import { setUserDepartmentAction } from "@/app/actions/departments";
import { validateDepartmentSetupInput, validateUserSetupInput } from "@/lib/setup/validation";
import type { PayType, UserRole } from "@/types/flow";

function revalidateAll() {
  revalidatePath("/", "layout");
}

async function assignUserToDepartmentBranch(
  userId: string,
  departmentId: string,
  roleInDept: "member" | "lead" | "manager"
) {
  await setUserDepartmentAction(userId, departmentId, {
    is_primary: true,
    role_in_department: roleInDept,
  });
}

export async function completeDepartmentSetupAction(input: {
  name: string;
  purpose?: string;
  senior_manager_id: string;
  manager_ids: string[];
  teams: {
    name: string;
    team_lead_id: string;
    manager_id?: string;
    employee_ids?: string[];
  }[];
}) {
  const actor = await requirePermission("departments:manage");
  initFlowStore();
  const users = getFlowStore().users;

  validateDepartmentSetupInput({
    name: input.name,
    senior_manager_id: input.senior_manager_id,
    manager_ids: input.manager_ids,
    team_definitions: input.teams.map((t) => ({
      name: t.name,
      team_lead_id: t.team_lead_id,
      manager_id: t.manager_id,
    })),
  });

  const dept = createDepartment({
    name: input.name.trim(),
    description: input.purpose?.trim() || null,
    lead_user_id: input.senior_manager_id,
  });

  await assignUserToDepartmentBranch(input.senior_manager_id, dept.id, "manager");
  await updateUserDetailsAction(input.senior_manager_id, {
    role: "senior_manager",
    manager_id: users.find((u) => u.role === "admin" || u.role === "super_admin")?.id ?? null,
  });

  for (const managerId of input.manager_ids) {
    await assignUserToDepartmentBranch(managerId, dept.id, "manager");
    await updateUserDetailsAction(managerId, {
      role: "manager",
      manager_id: input.senior_manager_id,
    });
  }

  for (const teamDef of input.teams) {
    const managerId =
      teamDef.manager_id ??
      input.manager_ids.find((id) => {
        const lead = users.find((u) => u.id === teamDef.team_lead_id);
        return lead?.manager_id === id;
      }) ??
      input.manager_ids[0];

    const team = createTeam({
      name: teamDef.name.trim(),
      department_id: dept.id,
      manager_id: managerId,
    });

    await assignUserToDepartmentBranch(teamDef.team_lead_id, dept.id, "lead");
    await updateUserDetailsAction(teamDef.team_lead_id, {
      role: "teamlead",
      team_id: team.id,
      manager_id: managerId,
    });

    for (const employeeId of teamDef.employee_ids ?? []) {
      await assignUserToDepartmentBranch(employeeId, dept.id, "member");
      await updateUserDetailsAction(employeeId, {
        role: "employee",
        team_id: team.id,
        manager_id: teamDef.team_lead_id,
      });
    }
  }

  await writeAuditLog({
    action: "project_changed",
    entityType: "department",
    entityId: dept.id,
    summary: `Guided setup completed for department ${dept.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return { ok: true as const, departmentId: dept.id };
}

export async function completeUserSetupAction(input: {
  mode: "create" | "update";
  user_id?: string;
  email?: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department_id?: string;
  team_id?: string | null;
  manager_id?: string | null;
  position_id?: string | null;
  hire_date?: string | null;
  pay_type?: PayType;
}) {
  const actor = await requirePermission("users:manage");
  initFlowStore();
  const users = getFlowStore().users;

  validateUserSetupInput({
    role: input.role,
    department_id: input.department_id,
    team_id: input.team_id,
    manager_id: input.manager_id,
    user_id: input.user_id,
    users,
  });

  let userId = input.user_id;

  if (input.mode === "create") {
    if (!input.email || !input.password) {
      throw new Error("Email and password are required to create a user.");
    }
    const result = await createUserManuallyAction({
      email: input.email,
      password: input.password,
      first_name: input.first_name,
      last_name: input.last_name,
      role: input.role,
      team_id: input.team_id ?? null,
      manager_id: input.manager_id ?? null,
      hire_date: input.hire_date ?? null,
      pay_type: input.pay_type,
    });
    if (!result.user?.id) throw new Error("User creation failed.");
    userId = result.user.id;
  } else if (userId) {
    const existing = users.find((u) => u.id === userId);
    await updateUserDetailsAction(userId, {
      first_name: input.first_name,
      last_name: input.last_name,
      team_id: input.team_id ?? null,
      manager_id: input.manager_id ?? null,
      hire_date: input.hire_date ?? null,
      pay_type: input.pay_type,
    });
    if (existing && existing.role !== input.role) {
      await updateUserRoleAction(userId, input.role, "Guided setup wizard");
    }
  } else {
    throw new Error("User id is required for update mode.");
  }

  if (!userId) throw new Error("User setup failed.");

  const deptRole =
    input.role === "senior_manager" || input.role === "manager"
      ? "manager"
      : input.role === "teamlead"
        ? "lead"
        : "member";

  if (input.department_id && !["admin", "super_admin", "viewer"].includes(input.role)) {
    await setUserDepartmentAction(userId, input.department_id, {
      is_primary: true,
      role_in_department: deptRole,
    });
  }

  initFlowStore();
  const updatedUsers = getFlowStore().users;
  const user = updatedUsers.find((u) => u.id === userId);
  if (user && input.manager_id) {
    syncHierarchyOnManagerChange(
      userId,
      input.manager_id,
      updatedUsers,
      input.team_id ?? user.team_id
    );
  }

  if (input.position_id) {
    const { assignUserToPositionAction } = await import("@/app/actions/positions");
    await assignUserToPositionAction(input.position_id, userId);
  }

  await writeAuditLog({
    action: input.mode === "create" ? "user_created" : "assignment_changed",
    entityType: "user",
    entityId: userId,
    summary: `Guided user setup completed for ${input.first_name} ${input.last_name}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return { ok: true as const, userId };
}

export async function bulkAssignUsersAction(input: {
  user_ids: string[];
  department_id?: string;
  team_id?: string | null;
  manager_id?: string | null;
}) {
  const actor = await requirePermission("users:manage");
  if (!input.user_ids.length) throw new Error("Select at least one user.");

  initFlowStore();
  const users = getFlowStore().users;

  for (const userId of input.user_ids) {
    const user = users.find((u) => u.id === userId);
    if (!user) continue;

    if (input.department_id) {
      await setUserDepartmentAction(userId, input.department_id, { is_primary: true });
    }

    const updates: Parameters<typeof updateUserDetailsAction>[1] = {};
    if (input.team_id !== undefined) updates.team_id = input.team_id;
    if (input.manager_id !== undefined) updates.manager_id = input.manager_id;

    if (Object.keys(updates).length) {
      validateUserSetupInput({
        role: user.role,
        department_id: input.department_id ?? null,
        team_id: updates.team_id ?? user.team_id,
        manager_id: updates.manager_id ?? user.manager_id,
        user_id: userId,
        users,
      });
      await updateUserDetailsAction(userId, updates);
    }
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "user",
    entityId: input.user_ids.join(","),
    summary: `Bulk assignment updated for ${input.user_ids.length} users`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return { ok: true as const, count: input.user_ids.length };
}

export async function bulkInviteUsersAction(input: {
  emails: string[];
  department_id?: string;
  team_id?: string | null;
  manager_id?: string | null;
}) {
  const actor = await requirePermission("users:manage");
  const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) throw new Error("Enter at least one email address.");

  const { inviteUserAction } = await import("@/app/actions/auth");
  const invited: string[] = [];

  for (const email of emails) {
    const local = email.split("@")[0] ?? "user";
    const firstName = local.replace(/[._-]/g, " ").split(" ")[0] ?? "New";
    const lastName = local.includes(".") ? (local.split(".").pop() ?? "") : "";

    await inviteUserAction(
      email,
      firstName.charAt(0).toUpperCase() + firstName.slice(1),
      lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1) : "User",
      "employee",
      input.team_id ?? null,
      input.manager_id ?? null
    );
    invited.push(email);
  }

  if (input.department_id) {
    initFlowStore();
    const users = getFlowStore().users;
    for (const email of invited) {
      const user = users.find((u) => u.email === email);
      if (user) {
        await setUserDepartmentAction(user.id, input.department_id, {
          is_primary: true,
          role_in_department: "member",
        });
      }
    }
  }

  await writeAuditLog({
    action: "user_invited",
    entityType: "user",
    entityId: invited.join(","),
    summary: `Bulk invited ${invited.length} users as employees`,
    metadata: {
      count: invited.length,
      department_id: input.department_id ?? null,
      team_id: input.team_id ?? null,
      manager_id: input.manager_id ?? null,
    },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return { ok: true as const, count: invited.length, emails: invited };
}
