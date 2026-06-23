"use client";

import { useState, useTransition } from "react";
import {
  assignDepartmentLeadAction,
  assignTeamLeadAction,
  assignTeamManagerAction,
  assignUserToDepartmentTeamAction,
  createTeamAction,
  updateDepartmentAction,
  updateTeamAction,
} from "@/app/actions/departments";
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
import { formatActionError } from "@/lib/errors/action-messages";
import type { Department, Team, User } from "@/types/flow";

export function DepartmentManageDialog({
  department,
  teams,
  users,
  onClose,
  onUpdated,
}: {
  department: Department;
  teams: Team[];
  users: User[];
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(department.name);
  const [desc, setDesc] = useState(department.description ?? "");
  const [leadId, setLeadId] = useState(department.lead_user_id ?? "");
  const [newTeamName, setNewTeamName] = useState("");

  const deptTeams = teams.filter((t) => t.department_id === department.id);
  const managerPool = users.filter((u) => u.is_active);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onUpdated?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <div className="space-y-5 p-1">
      <div>
        <p className="text-sm font-semibold">{department.name}</p>
        <p className="text-xs text-muted-foreground">Manage department structure and assignments</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Department lead</Label>
          <Select value={leadId || "__none__"} onValueChange={(v) => setLeadId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Vacant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Vacant</SelectItem>
              {managerPool.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await updateDepartmentAction(department.id, {
                name: name.trim(),
                description: desc || null,
              });
              if (leadId !== (department.lead_user_id ?? "")) {
                await assignDepartmentLeadAction(department.id, leadId || null);
              }
            })
          }
        >
          Save department
        </Button>
      </div>

      <div className="border-t border-border/50 pt-4 space-y-3">
        <Label>Teams</Label>
        {deptTeams.map((team) => (
          <TeamManageRow key={team.id} team={team} users={managerPool} pending={pending} onRun={run} />
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="New team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !newTeamName.trim()}
            onClick={() =>
              run(async () => {
                await createTeamAction({
                  name: newTeamName.trim(),
                  department_id: department.id,
                });
                setNewTeamName("");
              })
            }
          >
            Add team
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function TeamManageRow({
  team,
  users,
  pending,
  onRun,
}: {
  team: Team;
  users: User[];
  pending: boolean;
  onRun: (action: () => Promise<unknown>) => void;
}) {
  const [managerId, setManagerId] = useState(team.manager_id ?? "");
  const [leadId, setLeadId] = useState(team.team_lead_user_id ?? "");

  return (
    <div className="rounded-lg border border-border/40 p-3 space-y-2">
      <p className="text-sm font-medium">{team.name}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={managerId || "__none__"} onValueChange={(v) => setManagerId(!v || v === "__none__" ? "" : v)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Manager" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Vacant</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={leadId || "__none__"} onValueChange={(v) => setLeadId(!v || v === "__none__" ? "" : v)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Team lead" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Vacant</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={pending}
        onClick={() =>
          onRun(async () => {
            if (managerId !== (team.manager_id ?? "")) {
              await assignTeamManagerAction(team.id, managerId || null);
            }
            if (leadId !== (team.team_lead_user_id ?? "")) {
              await assignTeamLeadAction(team.id, leadId || null);
            }
            await updateTeamAction(team.id, { name: team.name });
          })
        }
      >
        Save team slots
      </Button>
    </div>
  );
}

export function TeamAssignMemberDialog({
  team,
  departmentId,
  users,
  onAssigned,
  onCancel,
}: {
  team: Team;
  departmentId: string;
  users: User[];
  onAssigned?: () => void;
  onCancel?: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const candidates = users.filter((u) => u.is_active);

  function submit() {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignUserToDepartmentTeamAction({
          userId,
          departmentId,
          teamId: team.id,
          role_in_department: "member",
          manager_id: team.team_lead_user_id ?? team.manager_id ?? null,
        });
        onAssigned?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <div className="space-y-4 p-1">
      <p className="text-sm font-medium">Assign member to {team.name}</p>
      <Select value={userId || "__pick__"} onValueChange={(v) => setUserId(!v || v === "__pick__" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__pick__">Select user…</SelectItem>
          {candidates.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="button" size="sm" disabled={!userId || pending} onClick={submit}>
          Assign
        </Button>
      </div>
    </div>
  );
}
