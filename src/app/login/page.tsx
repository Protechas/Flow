import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDemoUsersForLogin } from "@/lib/auth/demo-session";
import { getDefaultRoute } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import Link from "next/link";
import { redirect } from "next/navigation";

const AUTH_ERRORS: Record<string, string> = {
  no_profile: "No active profile found. Contact an administrator.",
  auth_callback: "Sign-in link expired or invalid. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cleared?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(getDefaultRoute(user.role));

  const { error: errorCode, cleared } = await searchParams;
  const authError = errorCode
    ? AUTH_ERRORS[errorCode] ?? decodeURIComponent(errorCode)
    : null;

  const supabaseEnabled = isSupabaseConfigured();
  const demoUsers = supabaseEnabled ? [] : getDemoUsersForLogin();

  return (
    <div className="flow-login-scene dark min-h-screen flex items-center justify-center p-4">
      <Card className="flow-login-card w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flow-login-brand mx-auto mb-4">F</div>
          <CardTitle className="flow-login-title-glow text-2xl font-semibold tracking-tight">
            Flow
          </CardTitle>
          <CardDescription className="text-sm">
            Your operations command center
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cleared === "1" && (
            <p className="text-sm text-emerald-400 text-center mb-4">
              Session cleared. Sign in again.
            </p>
          )}
          {authError && (
            <p className="text-sm text-destructive text-center mb-4">{authError}</p>
          )}
          <LoginForm demoUsers={demoUsers} supabaseEnabled={supabaseEnabled} />
          {supabaseEnabled && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              Stuck signing in?{" "}
              {/* prefetch must stay off: prefetching this route executes it,
                  signing the user out immediately after login. */}
              <Link href="/auth/clear" prefetch={false} className="text-primary hover:underline">
                Clear session
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
