import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  getDemoRoleFromUserId,
  isSupabaseConfigured,
  redirectPathForRole,
  roleCanAccessPath,
  shouldProtectRoute,
} from "@/lib/auth/route-guard";

const DEMO_USER_COOKIE = "flow_demo_user_id";

export async function middleware(request: NextRequest) {
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
      const url = request.nextUrl.clone();
      url.pathname = role ? redirectPathForRole(role) : "/operations";
      return NextResponse.redirect(url);
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

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
