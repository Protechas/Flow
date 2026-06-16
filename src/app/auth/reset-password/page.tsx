import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { redirect } from "next/navigation";

export default function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">Set your password</CardTitle>
          <CardDescription>
            Choose a password for your Flow account (invite or reset link)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
