import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDemoUsersForLogin } from "@/lib/auth/demo-session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Waves } from "lucide-react";

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

  const demoUsers = getDemoUsersForLogin();
  const supabaseEnabled = isSupabaseConfigured();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-background to-indigo-950/30 pointer-events-none" />
      <Card className="w-full max-w-md relative border-border/60">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
            <Waves className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Flow</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <p className="text-sm text-red-400 text-center mb-4">{authError}</p>
          )}
          <LoginForm demoUsers={demoUsers} supabaseEnabled={supabaseEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
