"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { rethrowNextNavigation } from "@/lib/navigation/rethrow-server-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUpForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const submittedEmail = (fd.get("email") as string).trim();
    startTransition(async () => {
      try {
        const res = await signUpAction({
          email: submittedEmail,
          password: fd.get("password") as string,
          firstName: fd.get("first_name") as string,
          lastName: fd.get("last_name") as string,
        });
        if (res.needsEmailConfirmation) {
          setEmail(submittedEmail);
          setSubmitted(true);
        }
      } catch (err) {
        rethrowNextNavigation(err);
        setError(err instanceof Error ? err.message : "Could not create account");
      }
    });
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Check your email at <span className="text-foreground font-medium">{email}</span> and
          confirm your account. After that, sign in and your manager will finish your team setup.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground text-center leading-relaxed">
        Create a basic employee account. Your manager will assign your department, team, and
        supervisor before work begins.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" required autoComplete="given-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" autoComplete="family-name" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters</p>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
