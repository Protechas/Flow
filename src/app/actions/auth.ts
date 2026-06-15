"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { clearDemoSession, setDemoUserCookie } from "@/lib/auth/demo-session";
import { useSecureCookies } from "@/lib/auth/cookie-options";
import { getDefaultRoute, normalizeRole } from "@/lib/auth/permissions";
import {
  createUserRecord,
  getUserProfileByAuthId,
  recordLastLogin,
} from "@/lib/data/users";
import { formatFullName } from "@/lib/users/format";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { requirePermission } from "@/lib/auth/session";
import { MOCK_USERS } from "@/lib/data/mock-data";
import type { UserRole } from "@/types/flow";

const REMEMBER_ME_COOKIE = "flow_remember_me";

export async function demoLoginAction(userId: string, rememberMe = false) {
  if (isSupabaseConfigured()) {
    throw new Error("Demo login is only available when FLOW_DEMO_MODE is enabled");
  }
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error("Invalid demo user");
  if (!user.is_active) throw new Error("Account is disabled");
  await setDemoUserCookie(userId, rememberMe);
  await recordLastLogin(userId);
  revalidatePath("/", "layout");
  redirect(getDefaultRoute(normalizeRole(user.role)));
}

export async function supabaseLoginAction(
  email: string,
  password: string,
  rememberMe = false
) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const profile = data.user ? await getUserProfileByAuthId(data.user.id) : null;

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    throw new Error("Your account is inactive. Contact an administrator.");
  }

  if (rememberMe) {
    const store = await cookies();
    store.set(REMEMBER_ME_COOKIE, "1", {
      httpOnly: true,
      secure: useSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  if (profile) await recordLastLogin(profile.id);

  revalidatePath("/", "layout");
  redirect(getDefaultRoute(profile?.role ?? "employee"));
}

export async function requestPasswordResetAction(email: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Password reset requires Supabase authentication");
  }
  const supabase = await createClient();
  const siteUrl = getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function inviteUserAction(
  email: string,
  firstName: string,
  lastName: string,
  role: UserRole,
  teamId?: string | null,
  managerId?: string | null
) {
  const actor = await requirePermission("users:manage");
  const fullName = formatFullName(firstName, lastName);

  if (!isSupabaseConfigured()) {
    const id = `user-${email.split("@")[0]}`;
    await createUserRecord({
      id,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: fullName,
      role,
      team_id: teamId ?? "team-1",
      manager_id: managerId ?? null,
      hire_date: null,
      avatar_url: null,
      last_login_at: null,
      is_active: true,
    });
    await writeAuditLog({
      action: "user_invited",
      entityType: "user",
      entityId: id,
      summary: `Invited ${fullName} (${role})`,
      metadata: { email, role },
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidatePath("/", "layout");
    return { ok: true as const, email };
  }

  if (!isAdminConfigured()) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY in .env.local to invite users");
  }

  const admin = createAdminClient();
  const siteUrl = getSiteUrl();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
        role,
        team_id: teamId,
        manager_id: managerId,
      },
    }
  );

  if (error) throw new Error(error.message);

  if (data.user) {
    const { error: profileError } = await admin.from("users").upsert(
      {
        id: data.user.id,
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
        role,
        team_id: teamId,
        manager_id: managerId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (profileError) throw new Error(profileError.message);
  }

  await writeAuditLog({
    action: "user_invited",
    entityType: "user",
    entityId: data.user?.id,
    summary: `Invited ${fullName} (${role})`,
    metadata: { email, role },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidatePath("/", "layout");
  return { ok: true as const, email };
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    const store = await cookies();
    store.delete(REMEMBER_ME_COOKIE);
  } else {
    await clearDemoSession();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function switchDemoUserAction(userId: string) {
  if (isSupabaseConfigured()) {
    throw new Error("Role switcher is only available in demo mode");
  }
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error("Invalid user");
  await setDemoUserCookie(userId, true);
  revalidatePath("/", "layout");
  redirect(getDefaultRoute(normalizeRole(user.role)));
}
