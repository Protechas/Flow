import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getDefaultRoute, normalizeRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/site-url";

/** Safe in-app path from auth link query params. */
export function authRedirectPath(next: string | null | undefined): string {
  const raw = (next ?? "/").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/** Build redirectTo for Supabase invite / recovery emails. */
export function buildAuthEmailRedirect(nextPath: string): string {
  const siteUrl = getSiteUrl();
  const next = encodeURIComponent(authRedirectPath(nextPath));
  return `${siteUrl}/auth/confirm?next=${next}`;
}

export async function handleAuthExchange(request: Request): Promise<NextResponse> {
  const baseUrl = getSiteUrl();
  const { searchParams } = new URL(request.url);
  const nextPath = authRedirectPath(searchParams.get("next"));
  const errorParam = searchParams.get("error_description");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Password reset and invite links require production auth. Open flowproduction.space.")}`
    );
  }

  if (errorParam) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(errorParam)}`
    );
  }

  const supabase = await createClient();
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error.message || "auth_callback")}`
      );
    }
    return redirectAfterAuthSession(supabase, baseUrl, nextPath);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error.message || "auth_callback")}`
      );
    }
    return redirectAfterAuthSession(supabase, baseUrl, nextPath);
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback`);
}

async function redirectAfterAuthSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseUrl: string,
  nextPath: string
): Promise<NextResponse> {
  if (nextPath !== "/") {
    return NextResponse.redirect(`${baseUrl}${nextPath}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile ? normalizeRole(String(profile.role)) : "employee";
    return NextResponse.redirect(`${baseUrl}${getDefaultRoute(role)}`);
  }

  return NextResponse.redirect(`${baseUrl}${nextPath}`);
}
