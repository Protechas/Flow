import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyRememberMeToAuthCookie,
  isRememberMeEnabled,
} from "@/lib/auth/remember-me";

export type SessionRefreshResult = {
  response: NextResponse;
  user: { id: string } | null;
};

/**
 * Refresh Supabase auth cookies at the edge. No DB/profile lookups — those stay
 * in server layouts to avoid login hangs on cross-region Postgres.
 */
export async function refreshSupabaseSession(
  request: NextRequest
): Promise<SessionRefreshResult> {
  let response = NextResponse.next({ request });
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
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
