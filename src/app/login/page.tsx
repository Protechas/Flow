import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDemoUsersForLogin } from "@/lib/auth/demo-session";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const AUTH_ERRORS: Record<string, string> = {
  no_profile: "No active profile found. Contact an administrator.",
  auth_callback: "Sign-in link expired or invalid. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  const authError = errorCode
    ? AUTH_ERRORS[errorCode] ?? decodeURIComponent(errorCode)
    : null;

  const supabaseEnabled = isSupabaseConfigured();
  const demoUsers = supabaseEnabled ? [] : getDemoUsersForLogin();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">Flow</CardTitle>
          <CardDescription className="text-sm">
            Enterprise operations platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <p className="text-sm text-destructive text-center mb-4">{authError}</p>
          )}
          <LoginForm demoUsers={demoUsers} supabaseEnabled={supabaseEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
