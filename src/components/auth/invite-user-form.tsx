"use client";

import { useState, useTransition } from "react";
import { inviteUserAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLES } from "@/lib/constants";
import type { Team, User, UserRole } from "@/types/flow";

export function InviteUserForm({
  teams,
  managers,
}: {
  teams: Team[];
  managers: User[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("employee");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [managerId, setManagerId] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        const result = await inviteUserAction(
          fd.get("email") as string,
          fd.get("first_name") as string,
          fd.get("last_name") as string,
          role,
          teamId || null,
          managerId || null
        );
        setSuccess(`Invite sent to ${result.email}`);
        form.reset();
        setRole("employee");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invite failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
    >
      <div>
        <h3 className="font-semibold text-sm">Invite user</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Sends an email invite. User sets their password on first sign-in.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-first">First name</Label>
          <Input id="invite-first" name="first_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-last">Last name</Label>
          <Input id="invite-last" name="last_name" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Team</Label>
          <Select value={teamId} onValueChange={(v) => v && setTeamId(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Manager</Label>
          <Select value={managerId || "__none__"} onValueChange={(v) => setManagerId(v && v !== "__none__" ? v : "")}>
            <SelectTrigger>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending invite…" : "Send invite"}
      </Button>
      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
