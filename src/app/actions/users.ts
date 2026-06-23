"use server";

import { revalidatePath } from "next/cache";
import { listAuditLog, writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { teamLeadCanViewPerson } from "@/lib/auth/team-scope";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  createUserRecord,
  getUserById,
  listTeams,
  listUsers,
  setUserActive,
  updateUserProfile,
  updateUserAccessLevels,
  updateUserRole,
} from "@/lib/data/users";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { formatFullName } from "@/lib/users/format";
import type { OrganizationalPosition, PayType, SystemAccessLevel, UserRole } from "@/types/flow";

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
  const user = await updateUserRole(userId, role, {
    reason,
    changedBy: { id: actor.id, email: actor.email },
  });
  revalidatePath("/", "layout");
  return user;
}

export async function updateUserAccessLevelsAction(
  userId: string,
  organizationalPosition: OrganizationalPosition,
  systemAccessLevel: SystemAccessLevel,
  reason?: string
) {
  const actor = await requirePermission("users:manage");
  const user = await updateUserAccessLevels(userId, organizationalPosition, systemAccessLevel, {
    reason,
    changedBy: { id: actor.id, email: actor.email },
  });
  revalidatePath("/", "layout");
  return user;
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  await requirePermission("users:manage");
  const user = await setUserActive(userId, isActive);
  revalidatePath("/", "layout");
  return user;
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
  revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
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
  const siteUrl = getSiteUrl();
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
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
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
    return user;
  }

  throw new Error("FORBIDDEN");
}
