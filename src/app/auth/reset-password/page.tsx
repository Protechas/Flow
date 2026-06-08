import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Waves } from "lucide-react";

export default function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-background to-indigo-950/30 pointer-events-none" />
      <Card className="w-full max-w-md relative border-border/60">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
            <Waves className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Set your password</CardTitle>
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
