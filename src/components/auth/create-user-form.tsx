"use client";

import { useState, useTransition } from "react";
import { createUserManuallyAction } from "@/app/actions/users";
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
import { USER_ROLES, PAY_TYPES } from "@/lib/constants";
import type { PayType, Team, User, UserRole } from "@/types/flow";

export function CreateUserForm({
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
  const [payType, setPayType] = useState<PayType>("hourly");
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
        const result = await createUserManuallyAction({
          email: fd.get("email") as string,
          password: fd.get("password") as string,
          first_name: fd.get("first_name") as string,
          last_name: fd.get("last_name") as string,
          role,
          team_id: teamId || null,
          manager_id: managerId || null,
          hire_date: (fd.get("hire_date") as string) || null,
          pay_type: role === "employee" ? payType : "salary",
        });
        setSuccess(`User created: ${(fd.get("email") as string).trim()}`);
        form.reset();
        setRole("employee");
        setPayType("hourly");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4"
    >
      <div>
        <h3 className="font-semibold text-sm">Create user manually</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Set email and temporary password. User can change password after first login.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-first">First name</Label>
          <Input id="create-first" name="first_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-last">Last name</Label>
          <Input id="create-last" name="last_name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-email">Email</Label>
          <Input id="create-email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-password">Password</Label>
          <Input id="create-password" name="password" type="password" required minLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-hire">Hire date</Label>
          <Input id="create-hire" name="hire_date" type="date" />
        </div>
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
        {role === "employee" && (
          <div className="space-y-2">
            <Label>Pay type</Label>
            <Select value={payType} onValueChange={(v) => v && setPayType(v as PayType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAY_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hourly employees clock in/out; salary employees track time via tasks only.
            </p>
          </div>
        )}
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
        {pending ? "Creating…" : "Create user"}
      </Button>
      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
