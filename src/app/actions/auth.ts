"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { clearDemoSession, setDemoUserCookie } from "@/lib/auth/demo-session";
import {
  REMEMBER_ME_COOKIE,
  rememberMeCookieOptions,
} from "@/lib/auth/remember-me";
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
import { formatSignupError } from "@/lib/auth/signup-errors";
import { requirePermission } from "@/lib/auth/session";
import { withTimeout } from "@/lib/server/with-timeout";
import { MOCK_USERS } from "@/lib/data/mock-data";
import type { UserRole } from "@/types/flow";

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

export async function demoLoginFormAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const rememberMe = formData.get("rememberMe") === "true";
  await demoLoginAction(userId, rememberMe);
}

export async function supabaseLoginAction(
  email: string,
  password: string,
  rememberMe = false
) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const store = await cookies();
  if (rememberMe) {
    store.set(REMEMBER_ME_COOKIE, "1", rememberMeCookieOptions());
  } else {
    store.delete(REMEMBER_ME_COOKIE);
  }

  const supabase = await createClient();
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15_000,
    "Sign-in timed out. Supabase may be busy — wait 30 seconds and try again, or visit /auth/clear first."
  );
  if (error) throw new Error(error.message);

  const profile = data.user ? await getUserProfileByAuthId(data.user.id) : null;

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    store.delete(REMEMBER_ME_COOKIE);
    throw new Error("Your account is inactive. Contact an administrator.");
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

export type SignUpActionResult =
  | { ok: true; needsEmailConfirmation: true }
  | { ok: false; error: string };

export async function signUpAction(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<SignUpActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Account creation requires Supabase authentication" };
  }

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const password = input.password;

  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const supabase = await createClient();
  const siteUrl = getSiteUrl();
  const fullName = formatFullName(firstName, lastName);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/work`,
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        signup_type: "self",
        role: "employee",
      },
    },
  });

  if (error) {
    return {
      ok: false,
      error: formatSignupError(error.message, error.code ?? null),
    };
  }

  if (data.session && data.user) {
    try {
      await recordLastLogin(data.user.id);
    } catch {
      // Profile row may still be syncing; login should still proceed.
    }
    revalidatePath("/", "layout");
    redirect("/work");
  }

  return { ok: true, needsEmailConfirmation: true };
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
      role: role ?? "employee",
      team_id: teamId ?? null,
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

export async function switchDemoUserFormAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await switchDemoUserAction(userId);
}
