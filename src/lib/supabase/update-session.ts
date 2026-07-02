import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyRememberMeToAuthCookie,
  isRememberMeEnabled,
} from "@/lib/auth/remember-me";
import { hasSupabaseAuthCookies } from "@/lib/supabase/proxy-auth";

export type SessionRefreshResult = {
  response: NextResponse;
  user: { id: string } | null;
};

/**
 * Session gate for the proxy. Reads the session from cookies WITHOUT a network
 * call while the access token is fresh; only refreshes over the network when
 * the token is expired. If that network call fails (edge → Supabase has been
 * unreliable here before), FAIL OPEN when auth cookies are present: the server
 * layer re-validates every request with its own Supabase call and redirects to
 * /login itself if the session is truly dead. The edge must never be the
 * reason a signed-in user gets bounced.
 */
export async function refreshSupabaseSession(
  request: NextRequest
): Promise<SessionRefreshResult> {
  let response = NextResponse.next({ request });

  if (!hasSupabaseAuthCookies(request)) {
    return { response, user: null };
  }

  const rememberMe = isRememberMeEnabled(request.cookies);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              applyRememberMeToAuthCookie(options, rememberMe)
            )
          );
        },
      },
    }
  );

  try {
    // Cookie-only read while the token is valid; network refresh only when
    // expired (which also rewrites cookies via setAll above).
    const { data, error } = await supabase.auth.getSession();
    if (data.session?.user) {
      return { response, user: { id: data.session.user.id } };
    }
    if (error) {
      console.warn("[proxy] session refresh error — failing open:", error.message);
      return { response, user: { id: "unverified-edge-fallback" } };
    }
    // No error and no session: cookies exist but hold no usable session.
    return { response, user: null };
  } catch (err) {
    console.warn(
      "[proxy] session check threw — failing open:",
      err instanceof Error ? err.message : String(err)
    );
    return { response, user: { id: "unverified-edge-fallback" } };
  }
}

/** Copy Set-Cookie headers when replacing the middleware response (e.g. redirect). */
export function withSessionCookies(
  target: NextResponse,
  sessionResponse: NextResponse
): NextResponse {
  sessionResponse.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}
