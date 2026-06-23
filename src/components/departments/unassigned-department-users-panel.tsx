"use client";

import { useState, useTransition } from "react";
import { assignUserToDepartmentTeamAction } from "@/app/actions/departments";
import { formatActionError } from "@/lib/errors/action-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department, Team, User } from "@/types/flow";
import { UserCircle2 } from "lucide-react";

export function UnassignedDepartmentUsersPanel({
  users,
  departments,
  teams,
  canAssign,
  onAssigned,
}: {
  users: User[];
  departments: Department[];
  teams: Team[];
  canAssign: boolean;
  onAssigned?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeDepartments = departments.filter((d) => d.status === "active");
  const deptTeams = teams.filter((t) => t.department_id === departmentId);

  function submit(userId: string) {
    if (!departmentId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignUserToDepartmentTeamAction({
          userId,
          departmentId,
          teamId: teamId || null,
          role_in_department: "member",
        });
        setAssigningUserId(null);
        setDepartmentId("");
        setTeamId("");
        onAssigned?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  if (users.length === 0) return null;

  return (
    <div className="enterprise-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserCircle2 className="h-4 w-4 text-amber-400" />
        <div>
          <h3 className="text-sm font-semibold">Users not in a department</h3>
          <p className="text-xs text-muted-foreground">
            {users.length} user{users.length === 1 ? "" : "s"} available to assign into your structure.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium">User</th>
              <th className="text-left py-2 px-3 font-medium">Email</th>
              <th className="text-right py-2 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border/40">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span>{u.full_name}</span>
                    <Badge variant="outline" className="text-[10px]">Unassigned</Badge>
                  </div>
                </td>
                <td className="py-2 px-3 text-muted-foreground text-xs">{u.email}</td>
                <td className="py-2 px-3 text-right">
                  {canAssign && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAssigningUserId(u.id);
                        setDepartmentId("");
                        setTeamId("");
                      }}
                    >
                      Assign
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assigningUserId && canAssign && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
          <p className="text-sm font-medium">
            Assign {users.find((u) => u.id === assigningUserId)?.full_name}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={departmentId || "__pick__"} onValueChange={(v) => {
              setDepartmentId(!v || v === "__pick__" ? "" : v);
              setTeamId("");
            }}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__pick__">Select department…</SelectItem>
                {activeDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={teamId || "__none__"}
              onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}
              disabled={!departmentId}
            >
              <SelectTrigger><SelectValue placeholder="Team (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Department only</SelectItem>
                {deptTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !departmentId}
              onClick={() => submit(assigningUserId)}
            >
              {pending ? "Assigning…" : "Confirm assignment"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAssigningUserId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
