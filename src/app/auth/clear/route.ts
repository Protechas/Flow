import { DEMO_SESSION_COOKIE, DEMO_USER_COOKIE } from "@/lib/auth/demo-session";
import { REMEMBER_ME_COOKIE } from "@/lib/auth/remember-me";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function isFlowAuthCookie(name: string): boolean {
  return (
    name.includes("-auth-token") ||
    name === REMEMBER_ME_COOKIE ||
    name === DEMO_USER_COOKIE ||
    name === DEMO_SESSION_COOKIE
  );
}

export async function GET(request: Request) {
  // Never clear a session on speculative loads. Router/browser prefetches of
  // the "Clear session" link would otherwise sign the user out invisibly.
  const purpose =
    request.headers.get("next-router-prefetch") ??
    request.headers.get("sec-purpose") ??
    request.headers.get("purpose") ??
    request.headers.get("x-purpose");
  if (purpose !== null) {
    return new NextResponse(null, { status: 204 });
  }

  const store = await cookies();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Continue clearing cookies.
    }
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("cleared", "1");
  const response = NextResponse.redirect(login);

  for (const cookie of store.getAll()) {
    if (isFlowAuthCookie(cookie.name)) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }

  return response;
}
