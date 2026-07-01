import type { NextRequest } from "next/server";

export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  );
}

export function hasSupabaseAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.includes("-auth-token") && cookie.value.length > 0
  );
}
