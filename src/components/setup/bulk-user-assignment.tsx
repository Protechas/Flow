"use client";

import { useState, useTransition } from "react";
import { bulkAssignUsersAction } from "@/app/actions/setup";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterValidSupervisors } from "@/lib/setup/role-fields";
import type { Department, Team, User } from "@/types/flow";
import { Users } from "lucide-react";

export function BulkUserAssignment({
  users,
  departments,
  teams,
}: {
  users: User[];
  departments: Department[];
  teams: Team[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [managerId, setManagerId] = useState("");

  const assignableUsers = users.filter((u) => u.is_active && u.role === "employee");
  const supervisors = filterValidSupervisors("employee", users);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!selected.size) {
      setError("Select at least one user.");
      return;
    }
    if (!departmentId && !teamId && !managerId) {
      setError("Choose at least one assignment: department, team, or supervisor.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await bulkAssignUsersAction({
          user_ids: [...selected],
          department_id: departmentId || undefined,
          team_id: teamId || null,
          manager_id: managerId || null,
        });
        setMessage(`Updated ${result.count} users.`);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk assignment failed");
      }
    });
  }

  return (
    <div className="enterprise-panel p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Bulk assignment</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select multiple employees and assign department, team, and supervisor in one step.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 max-h-40 overflow-y-auto divide-y divide-border/40">
        {assignableUsers.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/20"
          >
            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
            {u.full_name}
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={departmentId || "__none__"} onValueChange={(v) => setDepartmentId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No change</SelectItem>
              {departments.filter((d) => d.status === "active").map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Team</Label>
          <Select value={teamId || "__none__"} onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No change</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Supervisor</Label>
          <Select value={managerId || "__none__"} onValueChange={(v) => setManagerId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No change</SelectItem>
              {supervisors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="button" onClick={submit} disabled={pending || selected.size === 0}>
        {pending ? "Applying…" : `Apply to ${selected.size || 0} selected`}
      </Button>

      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
