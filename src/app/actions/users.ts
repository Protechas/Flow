"use server";

import { revalidatePath } from "next/cache";
import { listAuditLog, writeAuditLog } from "@/lib/audit/audit-log";
import {
  revalidateUserAccessChange,
  revalidateUserOrgData,
} from "@/lib/data/revalidate-flow";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  deriveOrganizationalPositionFromRole,
  deriveSystemAccessLevelFromRole,
  syncLegacyRoleFromAccessFields,
  hasAdminAccess,
} from "@/lib/auth/access-level";
import { teamLeadCanViewPerson } from "@/lib/auth/team-scope";
import { getDepartmentUsersAction, removeUserDepartmentAction, setUserDepartmentAction } from "@/app/actions/departments";
import { assignUserToPositionAction, unassignUserFromPositionAction } from "@/app/actions/positions";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  createUserRecord,
  deleteUserAccount,
  getUserById,
  hydrateAppStore,
  listTeams,
  listUsers,
  setUserActive,
  updateUserProfile,
  updateUserAccessLevels,
  updateUserRole,
} from "@/lib/data/users";
import { auditUserFieldChanges } from "@/lib/users/profile-audit";
import {
  UserProfileValidationError,
  validateUserProfileInput,
} from "@/lib/users/profile-validation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { buildAuthEmailRedirect } from "@/lib/supabase/auth-redirect";
import { formatFullName } from "@/lib/users/format";
import { assertCanRemoveOrDeactivateUser, assertCanChangeUserAdminAccess } from "@/lib/users/admin-guards";
import type {
  EmploymentStatus,
  OrganizationalPosition,
  PayType,
  SystemAccessLevel,
  UserRole,
} from "@/types/flow";

export async function getUsersAction() {
  await requirePermission("users:manage");
  return listUsers();
}

export async function getTeamsAction() {
  await requirePermission("users:manage");
  return listTeams();
}

export async function getAuditLogAction() {
  await requirePermission("users:manage");
  return listAuditLog(50);
}

export async function updateUserRoleAction(
  userId: string,
  role: UserRole,
  reason?: string
) {
  const actor = await requirePermission("users:manage");
  const [before, users] = await Promise.all([getUserById(userId), listUsers()]);
  if (!before) throw new Error("User not found");
  assertCanChangeUserAdminAccess(
    actor.id,
    before,
    users,
    hasAdminAccess({
      ...before,
      role,
      organizational_position: deriveOrganizationalPositionFromRole(role),
      system_access_level: deriveSystemAccessLevelFromRole(role),
    })
  );
  const user = await updateUserRole(userId, role, {
    reason,
    changedBy: { id: actor.id, email: actor.email },
  });
  revalidateUserAccessChange();
  return user;
}

export async function updateUserAccessLevelsAction(
  userId: string,
  organizationalPosition: OrganizationalPosition,
  systemAccessLevel: SystemAccessLevel,
  reason?: string
) {
  const actor = await requirePermission("users:manage");
  const [before, users] = await Promise.all([getUserById(userId), listUsers()]);
  if (!before) throw new Error("User not found");
  assertCanChangeUserAdminAccess(
    actor.id,
    before,
    users,
    hasAdminAccess({
      ...before,
      organizational_position: organizationalPosition,
      system_access_level: systemAccessLevel,
    })
  );
  const user = await updateUserAccessLevels(userId, organizationalPosition, systemAccessLevel, {
    reason,
    changedBy: { id: actor.id, email: actor.email },
  });
  revalidateUserAccessChange();
  return user;
}

function sessionRevokeWarning(isActive: boolean): string | null {
  if (isActive || !isSupabaseConfigured() || isAdminConfigured()) return null;
  return "User updated but active sessions could not be revoked — set SUPABASE_SERVICE_ROLE_KEY so disabled users are signed out immediately.";
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  const actor = await requirePermission("users:manage");
  const [target, users] = await Promise.all([getUserById(userId), listUsers()]);
  if (!target) throw new Error("User not found");
  if (!isActive) {
    assertCanRemoveOrDeactivateUser(actor.id, target, users, "deactivate");
  }
  const user = await setUserActive(userId, isActive);
  revalidateUserOrgData();
  const sessionWarning = sessionRevokeWarning(isActive);
  return sessionWarning ? { user, sessionWarning } : user;
}

export async function adminDeleteUserAction(userId: string) {
  const actor = await requirePermission("users:manage");
  const [user, users] = await Promise.all([getUserById(userId), listUsers()]);
  if (!user) throw new Error("User not found");
  assertCanRemoveOrDeactivateUser(actor.id, user, users, "delete");

  await deleteUserAccount(userId);

  await writeAuditLog({
    action: "user_deleted",
    entityType: "user",
    entityId: userId,
    summary: `Deleted user ${user.full_name} (${user.email})`,
    metadata: { email: user.email, role: user.role },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateUserOrgData();
  return { ok: true as const };
}

export async function updateUserDetailsAction(
  userId: string,
  data: {
    first_name?: string;
    last_name?: string;
    role?: UserRole;
    team_id?: string | null;
    manager_id?: string | null;
    hire_date?: string | null;
    pay_type?: PayType;
    branch_view_access?: boolean;
  }
) {
  await requirePermission("users:manage");
  const user = await updateUserProfile(userId, data);
  if (user && data.team_id !== undefined) {
    await writeAuditLog({
      action: "team_changed",
      entityType: "user",
      entityId: userId,
      summary: `Team updated for ${user.full_name}`,
      metadata: { team_id: data.team_id },
    });
  }
  if (data.role !== undefined) {
    revalidateUserAccessChange();
  } else {
    revalidateUserOrgData();
  }
  return user;
}

export async function createUserManuallyAction(data: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  team_id?: string | null;
  manager_id?: string | null;
  hire_date?: string | null;
  pay_type?: PayType;
}) {
  const actor = await requirePermission("users:manage");
  const fullName = formatFullName(data.first_name, data.last_name);

  if (!isSupabaseConfigured()) {
    const id = `user-${data.email.split("@")[0]}`;
    const user = await createUserRecord({
      id,
      email: data.email.trim().toLowerCase(),
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      full_name: fullName,
      role: data.role ?? "employee",
      team_id: data.team_id ?? null,
      manager_id: data.manager_id ?? null,
      hire_date: data.hire_date ?? null,
      pay_type: data.pay_type ?? (data.role === "employee" ? "hourly" : "salary"),
      avatar_url: null,
      last_login_at: null,
      is_active: true,
    });
    await writeAuditLog({
      action: "user_created",
      entityType: "user",
      entityId: user.id,
      summary: `Created user ${fullName} (${data.role})`,
      metadata: { email: data.email, role: data.role },
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateUserOrgData();
    return { ok: true as const, user };
  }

  if (!isAdminConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required to create users");
  }

  const admin = createAdminClient();
  const { data: authData, error } = await admin.auth.admin.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    email_confirm: true,
    user_metadata: {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      full_name: fullName,
      role: data.role,
      team_id: data.team_id,
      manager_id: data.manager_id,
    },
  });
  if (error) throw new Error(error.message);

  const userId = authData.user!.id;
  await admin.from("users").upsert({
    id: userId,
    email: data.email.trim().toLowerCase(),
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    full_name: fullName,
    role: data.role,
    team_id: data.team_id,
    manager_id: data.manager_id,
    hire_date: data.hire_date,
    pay_type: data.pay_type ?? (data.role === "employee" ? "hourly" : "salary"),
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  await writeAuditLog({
    action: "user_created",
    entityType: "user",
    entityId: userId,
    summary: `Created user ${fullName} (${data.role})`,
    metadata: { email: data.email, role: data.role },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateUserOrgData();
  return { ok: true as const, userId };
}

export async function adminSetPasswordAction(userId: string, password: string) {
  await requirePermission("users:manage");
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    throw new Error("Setting passwords requires SUPABASE_SERVICE_ROLE_KEY on the server");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);

  const profile = await getUserById(userId);
  await writeAuditLog({
    action: "password_reset",
    entityType: "user",
    entityId: userId,
    summary: `Admin set password for ${profile?.email ?? userId}`,
  });

  return { ok: true as const };
}

export async function adminResetPasswordAction(userId: string, email: string) {
  await requirePermission("users:manage");
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    throw new Error("Password reset requires Supabase admin configuration");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthEmailRedirect("/auth/reset-password"),
  });
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "password_reset",
    entityType: "user",
    entityId: userId,
    summary: `Password reset email sent to ${email}`,
  });

  return { ok: true as const };
}

export async function updateEmployeePayTypeAction(userId: string, pay_type: PayType) {
  const actor = await requireUser();
  const target = await getUserById(userId);
  if (!target || target.role !== "employee") {
    throw new Error("Pay type applies to employees only");
  }

  if (hasPermission(actor.role, "users:manage")) {
    const user = await updateUserProfile(userId, { pay_type });
    revalidatePath("/work");
    return user;
  }

  if (hasPermission(actor.role, "people:view_team")) {
    initFlowStore();
    if (!teamLeadCanViewPerson(actor, userId, getFlowStore().users)) {
      throw new Error("FORBIDDEN");
    }
    const user = await updateUserProfile(userId, { pay_type });
    await writeAuditLog({
      action: "assignment_changed",
      entityType: "user",
      entityId: userId,
      summary: `Pay type set to ${pay_type} for ${target.full_name}`,
      metadata: { pay_type },
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidatePath("/work");
    return user;
  }

  throw new Error("FORBIDDEN");
}

export type SaveUserProfileInput = {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  department_id?: string | null;
  team_id?: string | null;
  manager_id?: string | null;
  assigned_position_id?: string | null;
  organizational_position: OrganizationalPosition;
  system_access_level: SystemAccessLevel;
  pay_type?: PayType | null;
  hire_date?: string | null;
  employment_status?: EmploymentStatus;
  is_active?: boolean;
  branch_view_access?: boolean;
};

function primaryDepartmentId(
  userId: string,
  departmentUsers: Awaited<ReturnType<typeof getDepartmentUsersAction>>
): string | null {
  const primary = departmentUsers.find((du) => du.user_id === userId && du.is_primary);
  return (
    primary?.department_id ??
    departmentUsers.find((du) => du.user_id === userId)?.department_id ??
    null
  );
}

export async function saveUserProfileAction(userId: string, input: SaveUserProfileInput) {
  const actor = await requirePermission("users:manage");
  const [before, users, teams, departmentUsers] = await Promise.all([
    getUserById(userId),
    listUsers(),
    listTeams(),
    getDepartmentUsersAction(),
  ]);
  if (!before) throw new UserProfileValidationError("User not found.");

  validateUserProfileInput({
    userId,
    first_name: input.first_name,
    last_name: input.last_name,
    full_name: input.full_name,
    email: input.email,
    manager_id: input.manager_id,
    department_id: input.department_id,
    team_id: input.team_id,
    users,
    teams,
  });

  const changes: Array<{
    field: string;
    previous: unknown;
    next: unknown;
    action?: import("@/types/flow").AuditAction;
  }> = [];

  const pushChange = (field: string, previous: unknown, next: unknown, action?: import("@/types/flow").AuditAction) => {
    changes.push({ field, previous, next, action });
  };

  const normalizedEmail = input.email.trim().toLowerCase();
  if (normalizedEmail !== before.email.trim().toLowerCase()) {
    if (!isSupabaseConfigured() || !isAdminConfigured()) {
      throw new UserProfileValidationError(
        "Changing login email requires Supabase admin configuration on the server."
      );
    }
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email: normalizedEmail,
    });
    if (authError) throw new UserProfileValidationError(authError.message);

    const { error: profileError } = await admin
      .from("users")
      .update({ email: normalizedEmail, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) throw new UserProfileValidationError(profileError.message);

    pushChange("email", before.email, normalizedEmail, "email_changed");
  }

  const prevDepartmentId = primaryDepartmentId(userId, departmentUsers);
  const nextDepartmentId = input.department_id ?? null;
  if (nextDepartmentId !== prevDepartmentId) {
    if (nextDepartmentId) {
      await setUserDepartmentAction(userId, nextDepartmentId, { is_primary: true });
    } else if (prevDepartmentId) {
      await removeUserDepartmentAction(userId, prevDepartmentId);
    }
    pushChange("department_id", prevDepartmentId, nextDepartmentId, "team_changed");
  }

  const nextPositionId = input.assigned_position_id ?? null;
  if (nextPositionId !== (before.assigned_position_id ?? null)) {
    await hydrateAppStore();
    if (nextPositionId) {
      await assignUserToPositionAction(nextPositionId, userId);
    } else if (before.assigned_position_id) {
      await unassignUserFromPositionAction(before.assigned_position_id);
    }
    pushChange("assigned_position_id", before.assigned_position_id, nextPositionId, "assignment_changed");
  }

  const syncedRole = syncLegacyRoleFromAccessFields(
    input.organizational_position,
    input.system_access_level
  );

  const nextIsActive = input.is_active ?? before.is_active;
  if (before.is_active && !nextIsActive) {
    assertCanRemoveOrDeactivateUser(actor.id, before, users, "deactivate");
  }

  assertCanChangeUserAdminAccess(
    actor.id,
    before,
    users,
    hasAdminAccess({
      ...before,
      organizational_position: input.organizational_position,
      system_access_level: input.system_access_level,
      role: syncedRole,
    })
  );

  const profilePayload = {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    full_name: input.full_name.trim(),
    phone: input.phone?.trim() || null,
    job_title: input.job_title?.trim() || null,
    team_id: input.team_id ?? null,
    manager_id: input.manager_id ?? null,
    hire_date: input.hire_date ?? null,
    pay_type: input.pay_type ?? before.pay_type ?? null,
    employment_status: input.employment_status ?? before.employment_status ?? "active",
    is_active: nextIsActive,
    branch_view_access: input.branch_view_access ?? before.branch_view_access ?? false,
    organizational_position: input.organizational_position,
    system_access_level: input.system_access_level,
    role: syncedRole,
  };

  const fieldMap: Array<[string, unknown, unknown]> = [
    ["first_name", before.first_name, profilePayload.first_name],
    ["last_name", before.last_name, profilePayload.last_name],
    ["full_name", before.full_name, profilePayload.full_name],
    ["phone", before.phone ?? null, profilePayload.phone],
    ["job_title", before.job_title ?? null, profilePayload.job_title],
    ["team_id", before.team_id, profilePayload.team_id],
    ["manager_id", before.manager_id, profilePayload.manager_id],
    ["hire_date", before.hire_date, profilePayload.hire_date],
    ["pay_type", before.pay_type, profilePayload.pay_type],
    ["employment_status", before.employment_status ?? "active", profilePayload.employment_status],
    ["is_active", before.is_active, profilePayload.is_active],
    ["branch_view_access", before.branch_view_access, profilePayload.branch_view_access],
    ["organizational_position", before.organizational_position, profilePayload.organizational_position],
    ["system_access_level", before.system_access_level, profilePayload.system_access_level],
    ["role", before.role, profilePayload.role],
  ];

  for (const [field, previous, next] of fieldMap) {
    pushChange(field, previous, next);
  }

  const updated = await updateUserProfile(userId, profilePayload);
  if (!updated) throw new UserProfileValidationError("Could not save user profile.");

  await auditUserFieldChanges({
    userId,
    userLabel: updated.full_name,
    actorId: actor.id,
    actorEmail: actor.email,
    changes,
  });

  const accessChanged =
    profilePayload.role !== before.role ||
    profilePayload.organizational_position !== before.organizational_position ||
    profilePayload.system_access_level !== before.system_access_level ||
    profilePayload.is_active !== before.is_active ||
    profilePayload.branch_view_access !== before.branch_view_access;

  if (accessChanged) {
    revalidateUserAccessChange();
  } else {
    revalidateUserOrgData();
  }
  const sessionWarning = sessionRevokeWarning(nextIsActive);
  return sessionWarning
    ? { ok: true as const, user: updated, sessionWarning }
    : { ok: true as const, user: updated };
}

export async function adminResendInviteAction(userId: string) {
  const actor = await requirePermission("users:manage");
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found.");

  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    throw new Error("Invite resend requires Supabase admin configuration");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(user.email, {
    redirectTo: buildAuthEmailRedirect("/auth/reset-password"),
    data: {
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: user.full_name,
      role: user.role,
      team_id: user.team_id,
      manager_id: user.manager_id,
    },
  });
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "user_invited",
    entityType: "user",
    entityId: userId,
    summary: `Resent invite to ${user.email}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  return { ok: true as const };
}
