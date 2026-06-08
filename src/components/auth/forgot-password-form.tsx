"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = (new FormData(e.currentTarget).get("email") as string).trim();
    startTransition(async () => {
      try {
        await requestPasswordResetAction(email);
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we sent a reset link. Check your inbox.
        </p>
        <Link href="/login" className="text-sm text-violet-400 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@company.com" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <p className="text-center text-sm">
        <Link href="/login" className="text-violet-400 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
