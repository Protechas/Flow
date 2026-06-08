"use server";

import { revalidatePath } from "next/cache";
import { listAuditLog, writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import {
  createUserRecord,
  listTeams,
  listUsers,
  setUserActive,
  updateUserProfile,
  updateUserRole,
} from "@/lib/data/users";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { formatFullName } from "@/lib/users/format";
import type { UserRole } from "@/types/flow";

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

export async function updateUserRoleAction(userId: string, role: UserRole) {
  await requirePermission("users:manage");
  const user = await updateUserRole(userId, role);
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
      role: data.role,
      team_id: data.team_id ?? "team-1",
      manager_id: data.manager_id ?? null,
      hire_date: data.hire_date ?? null,
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
