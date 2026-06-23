import { createClient } from "@/lib/supabase/server";
import { getDefaultRoute, normalizeRole } from "@/lib/auth/permissions";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ? getSiteUrl() : origin;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error_description");

  if (errorParam) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(errorParam)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && next === "/") {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const role = profile ? normalizeRole(String(profile.role)) : "employee";
        return NextResponse.redirect(`${baseUrl}${getDefaultRoute(role)}`);
      }

      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback`);
}
