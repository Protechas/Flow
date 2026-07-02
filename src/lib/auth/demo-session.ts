import { cookies } from "next/headers";
import { MOCK_USERS } from "@/lib/data/mock-data";
import { shouldUseSecureCookies } from "@/lib/auth/cookie-options";
import { normalizeRole } from "@/lib/auth/permissions";
import type { User, UserRole } from "@/types/flow";

export const DEMO_USER_COOKIE = "flow_demo_user_id";
export const DEMO_SESSION_COOKIE = "flow_demo_session";

export async function getDemoUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(DEMO_USER_COOKIE)?.value ?? null;
}

export async function setDemoUserCookie(userId: string, rememberMe = false) {
  const store = await cookies();
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  store.set(DEMO_USER_COOKIE, userId, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  store.set(DEMO_SESSION_COOKIE, "1", {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearDemoSession() {
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
  store.delete(DEMO_SESSION_COOKIE);
}

export async function getDemoUser(): Promise<User | null> {
  const id = await getDemoUserId();
  if (!id) return null;
  const user = MOCK_USERS.find((u) => u.id === id);
  if (!user || !user.is_active) {
    // Stale cookie for an unknown/inactive user. Cookies cannot be modified
    // during server-component render, so just treat it as signed out; the
    // cookie is overwritten on the next login (or cleared via /auth/clear).
    return null;
  }
  return { ...user, role: normalizeRole(user.role) };
}

export function getDemoUsersForLogin(): User[] {
  return MOCK_USERS.map((u) => ({ ...u, role: normalizeRole(u.role) }));
}

export function getDemoUsersByRole(role: UserRole): User[] {
  return getDemoUsersForLogin().filter((u) => normalizeRole(u.role) === role);
}
