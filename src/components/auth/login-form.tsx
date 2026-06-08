"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { demoLoginAction, supabaseLoginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/types/flow";

interface LoginFormProps {
  demoUsers: User[];
  supabaseEnabled: boolean;
}

export function LoginForm({ demoUsers, supabaseEnabled }: LoginFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  function handleDemoLogin(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await demoLoginAction(userId, rememberMe);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      }
    });
  }

  function handleSupabaseLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await supabaseLoginAction(
          fd.get("email") as string,
          fd.get("password") as string,
          rememberMe
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    });
  }

  const byRole = ["admin", "manager", "qa", "employee", "viewer"] as const;

  return (
    <div className="space-y-6">
      {supabaseEnabled && (
        <form onSubmit={handleSupabaseLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-border"
            />
            Remember me for 30 days
          </label>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/auth/forgot-password" className="text-violet-400 hover:underline">
              Forgot password?
            </Link>
          </p>
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
                    <Button
                      key={u.id}
                      type="button"
                      variant="outline"
                      className="justify-start h-auto py-2"
                      disabled={pending}
                      onClick={() => handleDemoLogin(u.id)}
                    >
                      <span className="font-medium">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                    </Button>
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
