import { useSecureCookies } from "@/lib/auth/cookie-options";

export type AuthCookieOptions = {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  path?: string;
  domain?: string;
};

export const REMEMBER_ME_COOKIE = "flow_remember_me";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

type CookieReader =
  | { get(name: string): { value: string } | undefined }
  | Array<{ name: string; value: string }>;

export function isRememberMeEnabled(cookies: CookieReader): boolean {
  if (Array.isArray(cookies)) {
    return cookies.some((c) => c.name === REMEMBER_ME_COOKIE && c.value === "1");
  }
  return cookies.get(REMEMBER_ME_COOKIE)?.value === "1";
}

export function rememberMeCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: REMEMBER_ME_MAX_AGE,
  };
}

/** Apply 30-day persistence or session-only cookies for Supabase auth tokens. */
export function applyRememberMeToAuthCookie(
  options: AuthCookieOptions,
  rememberMe: boolean
): AuthCookieOptions {
  if (rememberMe) {
    return { ...options, maxAge: REMEMBER_ME_MAX_AGE };
  }

  const { maxAge: _maxAge, expires: _expires, ...sessionOnly } = options;
  return sessionOnly;
}
