"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveOrgPositionAction,
  assignUserToPositionAction,
  markPositionStatusAction,
  moveOrgPositionAction,
  unassignUserFromPositionAction,
  updateOrgPositionAction,
} from "@/app/actions/positions";
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
import { ORGANIZATIONAL_POSITIONS } from "@/lib/constants";
import { formatActionError } from "@/lib/errors/action-messages";
import { POSITION_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import {
  departmentLabel,
  teamLabel,
  teamsForDepartment,
} from "@/lib/setup/role-fields";
import type {
  Department,
  OrganizationalPosition,
  OrgPosition,
  OrgPositionStatus,
  Team,
  User,
} from "@/types/flow";

const STATUS_OPTIONS: { value: OrgPositionStatus; label: string }[] = [
  { value: "vacant", label: "Vacant" },
  { value: "planned", label: "Planned" },
  { value: "filled", label: "Filled" },
];

export function PositionManageDialog({
  position,
  positions,
  users,
  departments,
  teams,
  onClose,
  onUpdated,
}: {
  position: OrgPosition;
  positions: OrgPosition[];
  users: User[];
  departments: Department[];
  teams: Team[];
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(position.title);
  const [level, setLevel] = useState<OrganizationalPosition>(position.position_level);
  const [departmentId, setDepartmentId] = useState(position.department_id ?? "");
  const [teamId, setTeamId] = useState(position.team_id ?? "");
  const [reportsToId, setReportsToId] = useState(position.reports_to_position_id ?? "");
  const [assignUserId, setAssignUserId] = useState(position.assigned_user_id ?? "");

  const deptTeams = useMemo(
    () => (departmentId ? teamsForDepartment(teams, departmentId) : teams),
    [teams, departmentId]
  );

  const parentOptions = useMemo(
    () =>
      positions.filter(
        (p) => p.id !== position.id && p.status !== "inactive"
      ),
    [positions, position.id]
  );

  const assignCandidates = useMemo(
    () =>
      users.filter(
        (u) =>
          u.is_active &&
          (!u.assigned_position_id || u.assigned_position_id === position.id)
      ),
    [users, position.id]
  );

  const assignedUser = users.find((u) => u.id === position.assigned_user_id);

  function refresh() {
    onUpdated?.();
    router.refresh();
  }

  function run(action: () => Promise<unknown>, closeOnSuccess = false) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        refresh();
        if (closeOnSuccess) onClose();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <div className="space-y-5 p-1">
      <div>
        <p className="text-sm font-semibold">{position.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {POSITION_DISPLAY_LABELS[position.position_level]} · Status: {position.status}
          {assignedUser ? ` · ${assignedUser.full_name}` : ""}
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <Select value={level} onValueChange={(v) => v && setLevel(v as OrganizationalPosition)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORGANIZATIONAL_POSITIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={departmentId || "__none__"}
              onValueChange={(v) => {
                setDepartmentId(!v || v === "__none__" ? "" : v);
                setTeamId("");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Team</Label>
            <Select
              value={teamId || "__none__"}
              onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {deptTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reports to</Label>
          <Select
            value={reportsToId || "__none__"}
            onValueChange={(v) => setReportsToId(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Top level</SelectItem>
              {parentOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending || !title.trim()}
          onClick={() =>
            run(async () => {
              await updateOrgPositionAction(position.id, {
                title: title.trim(),
                position_level: level,
                department_id: departmentId || null,
                team_id: teamId || null,
              });
              if (reportsToId !== (position.reports_to_position_id ?? "")) {
                await moveOrgPositionAction(position.id, reportsToId || null);
              }
            })
          }
        >
          Save position details
        </Button>
      </div>

      <div className="border-t border-border/50 pt-4 space-y-3">
        <Label>Assigned user</Label>
        <Select
          value={assignUserId || "__none__"}
          onValueChange={(v) => setAssignUserId(!v || v === "__none__" ? "" : v)}
        >
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {assignCandidates.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !assignUserId}
            onClick={() =>
              run(() => assignUserToPositionAction(position.id, assignUserId))
            }
          >
            Assign user
          </Button>
          {position.assigned_user_id && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => unassignUserFromPositionAction(position.id))}
            >
              Mark vacant
            </Button>
          )}
        </div>
      </div>

      <div className="border-t border-border/50 pt-4 space-y-3">
        <Label>Planning status</Label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.filter((s) => s.value !== "filled").map((s) => (
            <Button
              key={s.value}
              type="button"
              size="sm"
              variant={position.status === s.value ? "default" : "outline"}
              disabled={pending || position.status === s.value}
              onClick={() =>
                run(() => markPositionStatusAction(position.id, s.value))
              }
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/50 pt-4 flex flex-wrap gap-2 justify-between">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            run(() => archiveOrgPositionAction(position.id), true)
          }
        >
          Archive position
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {(departmentId || teamId) && (
        <p className="text-[10px] text-muted-foreground">
          {departmentLabel(departments, departmentId)}
          {teamId ? ` · ${teamLabel(teams, teamId)}` : ""}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
