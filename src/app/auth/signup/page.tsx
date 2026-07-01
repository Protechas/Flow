import { SignUpForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSelfSignupAllowed } from "@/lib/auth/signup-policy";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { redirect } from "next/navigation";

export default function SignUpPage() {
  if (!isSupabaseConfigured() || !isSelfSignupAllowed()) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">Create account</CardTitle>
          <CardDescription className="text-sm">Join Flow as an employee</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </div>
  );
}
