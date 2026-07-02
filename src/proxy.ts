import { type NextRequest, NextResponse } from "next/server";
import {
  getDemoRoleFromUserId,
  isSupabaseConfigured,
  redirectPathForRole,
  roleCanAccessPath,
  shouldProtectRoute,
} from "@/lib/auth/route-guard";
import { isPublicAuthPath } from "@/lib/supabase/proxy-auth";
import {
  refreshSupabaseSession,
  withSessionCookies,
} from "@/lib/supabase/update-session";

const DEMO_USER_COOKIE = "flow_demo_user_id";

/** Edge auth: refresh Supabase session cookies; demo mode uses cookie-only gate. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
    const hasDemoSession = request.cookies.get(DEMO_USER_COOKIE)?.value;

    if (!hasDemoSession && shouldProtectRoute(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (hasDemoSession && isAuthRoute) {
      const role = getDemoRoleFromUserId(hasDemoSession);
      // Stale cookie (unknown user): stay on the auth route so the user can
      // sign in again — redirecting away would loop with the page guards.
      if (role) {
        const url = request.nextUrl.clone();
        url.pathname = redirectPathForRole(role);
        return NextResponse.redirect(url);
      }
    }

    if (hasDemoSession && shouldProtectRoute(pathname)) {
      const role = getDemoRoleFromUserId(hasDemoSession);
      if (role && !roleCanAccessPath(role, pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = redirectPathForRole(role);
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  }

  const { response, user } = await refreshSupabaseSession(request);

  if (!user && !isPublicAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withSessionCookies(NextResponse.redirect(url), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
