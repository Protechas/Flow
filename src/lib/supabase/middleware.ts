import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyRememberMeToAuthCookie,
  isRememberMeEnabled,
} from "@/lib/auth/remember-me";
import {
  getDefaultRoute,
  normalizeRole,
} from "@/lib/auth/permissions";
import { roleCanAccessPath } from "@/lib/auth/route-guard";
import type { UserRole } from "@/types/flow";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  );
}

async function fetchUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<UserRole | null> {
  const { data } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!data || data.is_active === false) return null;
  return normalizeRole(String(data.role));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_FLOW_DEMO_MODE === "true"
  ) {
    return supabaseResponse;
  }

  const rememberMe = isRememberMeEnabled(request.cookies);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              applyRememberMeToAuthCookie(options, rememberMe)
            )
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = isPublicPath(pathname);

  if (!user) {
    if (!isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const role = await fetchUserRole(supabase, user.id);

  if (!role) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no_profile");
    return NextResponse.redirect(url);
  }

  const home = getDefaultRoute(role);

  const passwordSetupPaths = ["/auth/reset-password", "/auth/forgot-password"];
  const allowAuthWhileSignedIn = passwordSetupPaths.includes(pathname);

  if (
    isAuthRoute &&
    pathname !== "/auth/callback" &&
    !allowAuthWhileSignedIn
  ) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isAuthRoute && !roleCanAccessPath(role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
