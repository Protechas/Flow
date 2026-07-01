"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  demoLoginFormAction,
  supabaseLoginStateAction,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/types/flow";

interface LoginFormProps {
  demoUsers: User[];
  supabaseEnabled: boolean;
  selfSignupEnabled?: boolean;
}

function DemoUserSubmitButton({ user }: { user: User }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="justify-start h-auto py-2 w-full"
      disabled={pending}
    >
      <span className="font-medium">{user.full_name}</span>
      <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
    </Button>
  );
}

function SupabaseSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ demoUsers, supabaseEnabled, selfSignupEnabled = false }: LoginFormProps) {
  const [rememberMe, setRememberMe] = useState(true);
  const [error, submitSupabaseLogin] = useActionState(supabaseLoginStateAction, null);

  const byRole = ["admin", "manager", "teamlead", "employee", "viewer"] as const;

  return (
    <div className="space-y-6">
      {supabaseEnabled && (
        <form action={submitSupabaseLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <input type="hidden" name="rememberMe" value={rememberMe ? "true" : "false"} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-border"
            />
            Remember me for 30 days
          </label>
          <SupabaseSubmitButton />
          <p className="text-center text-sm">
            <Link href="/auth/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </p>
          {selfSignupEnabled && (
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/auth/signup" className="text-primary hover:underline">
                Create account
              </Link>
            </p>
          )}
        </form>
      )}

      {!supabaseEnabled && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Demo mode — pick a user to sign in (role switch testing)
          </p>
          <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-border"
            />
            Remember me
          </label>
          {byRole.map((role) => {
            const users = demoUsers.filter((u) => u.role === role && u.is_active);
            if (users.length === 0) return null;
            return (
              <div key={role} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground capitalize">
                  {role}
                </p>
                <div className="grid gap-2">
                  {users.map((u) => (
                    <form key={u.id} action={demoLoginFormAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        type="hidden"
                        name="rememberMe"
                        value={rememberMe ? "true" : "false"}
                      />
                      <DemoUserSubmitButton user={u} />
                    </form>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
    </div>
  );
}
