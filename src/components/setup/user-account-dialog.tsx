"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  adminResetPasswordAction,
  adminSetPasswordAction,
} from "@/app/actions/users";
import { UserSetupDialog } from "@/components/setup/user-setup-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatActionError } from "@/lib/errors/action-messages";
import { getUserSetupStatus } from "@/lib/setup/needs-setup";
import type { Department, DepartmentUser, OrgPosition, Team, User } from "@/types/flow";
import { ExternalLink, KeyRound, UserCog } from "lucide-react";

export function UserAccountDialog({
  user,
  users,
  departments,
  teams,
  departmentUsers = [],
  positions = [],
  canSetPassword,
  open,
  onOpenChange,
}: {
  user: User;
  users: User[];
  departments: Department[];
  teams: Team[];
  departmentUsers?: DepartmentUser[];
  positions?: OrgPosition[];
  canSetPassword: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);

  const setupStatus = getUserSetupStatus(user, departmentUsers, teams);

  function run(action: () => Promise<unknown>, success: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(success);
        setPassword("");
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" />
              Manage account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-right">{user.full_name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="text-right break-all">{user.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span>{user.is_active ? "Active" : "Disabled"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Last login</span>
                <span className="text-right">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : "Never"}
                </span>
              </div>
            </div>

            {canSetPassword ? (
              <div className="space-y-2">
                <Label htmlFor="admin-set-password" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Set password
                </Label>
                <Input
                  id="admin-set-password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sets the password immediately — no email required. Share it with the user securely.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || password.length < 8}
                  onClick={() =>
                    run(
                      () => adminSetPasswordAction(user.id, password),
                      "Password updated. The user can sign in now."
                    )
                  }
                >
                  {pending ? "Saving…" : "Set password"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => adminResetPasswordAction(user.id, user.email),
                      "Password reset email sent."
                    )
                  }
                >
                  Send reset email instead
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                Password management requires SUPABASE_SERVICE_ROLE_KEY on the server. Use
                Settings → Users → All users, or ask your platform admin.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {setupStatus === "needs_setup" && (
                <Button type="button" size="sm" variant="outline" onClick={() => setSetupOpen(true)}>
                  Complete setup
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                render={<Link href={`/people/${user.id}`} />}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View profile
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                render={<Link href={`/settings/users#user-${user.id}`} />}
              >
                Open in user management
              </Button>
            </div>

            {message && <p className="text-sm text-emerald-400">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {setupOpen && (
        <UserSetupDialog
          open={setupOpen}
          onOpenChange={setSetupOpen}
          user={user}
          users={users}
          departments={departments}
          teams={teams}
          positions={positions}
        />
      )}
    </>
  );
}
