"use client";

import { useState, useTransition } from "react";
import { bulkInviteUsersAction } from "@/app/actions/setup";
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
import type { Department, Team, User } from "@/types/flow";
import { Mail } from "lucide-react";

export function BulkInvitePanel({
  departments,
  teams,
  managers,
}: {
  departments: Department[];
  teams: Team[];
  managers: User[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [managerId, setManagerId] = useState("");

  const deptTeams = departmentId
    ? teams.filter((t) => t.department_id === departmentId)
    : teams;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const raw = (form.elements.namedItem("emails") as HTMLTextAreaElement).value;
    const emails = raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const result = await bulkInviteUsersAction({
          emails,
          department_id: departmentId || undefined,
          team_id: teamId || null,
          manager_id: managerId || null,
        });
        setSuccess(`Invited ${result.count} employee${result.count === 1 ? "" : "s"}.`);
        form.reset();
        setDepartmentId("");
        setTeamId("");
        setManagerId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk invite failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="enterprise-panel p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Bulk employee invites</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enter one email per line. All invites default to Employee role with
            limited access until setup is completed.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bulk-emails">Email addresses</Label>
        <textarea
          id="bulk-emails"
          name="emails"
          required
          rows={5}
          placeholder={"jane@company.com\njohn@company.com"}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Default department (optional)</Label>
          <Select value={departmentId || "__none__"} onValueChange={(v) => {
            setDepartmentId(!v || v === "__none__" ? "" : v);
            setTeamId("");
          }}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {departments.filter((d) => d.status === "active").map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Default team (optional)</Label>
          <Select value={teamId || "__none__"} onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {deptTeams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Default supervisor (optional)</Label>
          <Select value={managerId || "__none__"} onValueChange={(v) => setManagerId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
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
        {pending ? "Sending invites…" : "Send bulk invites"}
      </Button>

      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
