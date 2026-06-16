"use client";

import { useTransition } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { USER_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AccountSetupSummary } from "@/lib/setup/account";
import type { User } from "@/types/flow";
import { format } from "date-fns";
import { AlertCircle, Bell, LogOut, UserCircle } from "lucide-react";

export function EmployeeNeedsSetupView({
  user,
  setup,
}: {
  user: User;
  setup: AccountSetupSummary;
}) {
  const [pending, startTransition] = useTransition();
  const roleLabel =
    USER_ROLES.find((r) => r.value === user.role)?.label ?? user.role;

  return (
    <div className="space-y-6">
      <div className="enterprise-panel p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/25">
          <AlertCircle className="h-7 w-7 text-amber-400" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h1 className="text-xl font-semibold tracking-tight">
            Your account has been created.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your manager needs to finish assigning your department, team, and
            supervisor before work can begin.
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/40 text-amber-300">
          Needs setup
        </Badge>
      </div>

      <div className="enterprise-panel p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-primary" />
          Your profile
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="font-medium">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Role</dt>
            <dd className="font-medium">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Account created</dt>
            <dd className="font-medium">
              {format(new Date(user.created_at), "MMM d, yyyy")}
            </dd>
          </div>
        </dl>
        {setup.missingFields.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Still needed
            </p>
            <ul className="text-sm space-y-1">
              {setup.missingFields.map((field) => (
                <li key={field} className="text-amber-300/90">
                  {field}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href="/scorecard"
          className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-center")}
        >
          <UserCircle className="h-4 w-4 mr-1.5" />
          View scorecard
        </Link>
        <Link
          href="/notifications"
          className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-center")}
        >
          <Bell className="h-4 w-4 mr-1.5" />
          Notifications
        </Link>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={pending}
          onClick={() => startTransition(() => logoutAction())}
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          {pending ? "Signing out…" : "Log out"}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Contact your manager or administrator if you need help completing setup.
      </p>
    </div>
  );
}
