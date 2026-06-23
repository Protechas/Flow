"use client";

import { useState, useTransition } from "react";
import { assignUserToPositionAction } from "@/app/actions/positions";
import { formatActionError } from "@/lib/errors/action-messages";
import { getOrganizationalPosition, getSystemAccessLevel } from "@/lib/auth/access-level";
import { POSITION_DISPLAY_LABELS, ROLE_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgPosition, User } from "@/types/flow";
import { UserCircle2 } from "lucide-react";

export function PositionAssignDialog({
  position,
  users,
  onAssigned,
  onCancel,
}: {
  position: OrgPosition;
  users: User[];
  onAssigned?: () => void;
  onCancel?: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const candidates = users.filter((u) => u.is_active && !u.assigned_position_id);

  function submit() {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignUserToPositionAction(position.id, userId);
        onAssigned?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <div className="space-y-4 p-1">
      <div>
        <p className="text-sm font-medium">{position.title}</p>
        <p className="text-xs text-muted-foreground">
          {POSITION_DISPLAY_LABELS[position.position_level]} · Vacant seat
        </p>
      </div>
      <Select
        value={userId || "__pick__"}
        onValueChange={(v) => setUserId(!v || v === "__pick__" ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select user to assign" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__pick__">Select user…</SelectItem>
          {candidates.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No unassigned users available. Add users in Settings or unassign someone first.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" disabled={!userId || pending} onClick={submit}>
          {pending ? "Assigning…" : "Assign to position"}
        </Button>
      </div>
    </div>
  );
}

export function UnassignedUsersPanel({
  users,
  positions,
  departments,
  canAssign,
  onAssigned,
}: {
  users: User[];
  positions: OrgPosition[];
  departments: { id: string; name: string }[];
  canAssign: boolean;
  onAssigned?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const vacantPositions = positions.filter(
    (p) =>
      p.status !== "inactive" &&
      !p.assigned_user_id &&
      (p.status === "vacant" || p.status === "planned")
  );

  function suggestPosition(user: User): OrgPosition | null {
    if (user.team_id) {
      const match = vacantPositions.find((p) => p.team_id === user.team_id);
      if (match) return match;
    }
    const level = getOrganizationalPosition(user);
    return vacantPositions.find((p) => p.position_level === level) ?? vacantPositions[0] ?? null;
  }

  function assign(userId: string, posId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await assignUserToPositionAction(posId, userId);
        setAssigningUserId(null);
        setPositionId("");
        onAssigned?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  if (users.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserCircle2 className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold">Unassigned users</h3>
        <Badge variant="secondary" className="text-[10px]">
          {users.length}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        These users are not linked to an org position. Assign them to a seat to derive reporting,
        department, and team automatically.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border/40">
              <th className="text-left py-2 pr-3 font-medium">Name</th>
              <th className="text-left py-2 pr-3 font-medium">Email</th>
              <th className="text-left py-2 pr-3 font-medium">Access</th>
              <th className="text-left py-2 pr-3 font-medium">Suggested seat</th>
              <th className="text-right py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const suggested = suggestPosition(user);
              const isAssigning = assigningUserId === user.id;

              return (
                <tr key={user.id} className="border-b border-border/20">
                  <td className="py-2.5 pr-3 font-medium">{user.full_name}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{user.email}</td>
                  <td className="py-2.5 pr-3">
                    <span className="text-xs">
                      {ROLE_DISPLAY_LABELS[user.role]} ·{" "}
                      {getSystemAccessLevel(user) !== "standard"
                        ? getSystemAccessLevel(user)
                        : POSITION_DISPLAY_LABELS[getOrganizationalPosition(user)]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground text-xs">
                    {suggested?.title ?? "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {canAssign && (
                      isAssigning ? (
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={positionId || suggested?.id || "__pick__"}
                            onValueChange={(v) =>
                              setPositionId(!v || v === "__pick__" ? "" : v)
                            }
                          >
                            <SelectTrigger className="h-8 w-[180px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {vacantPositions.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            disabled={pending || !(positionId || suggested?.id)}
                            onClick={() =>
                              assign(user.id, positionId || suggested!.id)
                            }
                          >
                            Confirm
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => setAssigningUserId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={vacantPositions.length === 0}
                          onClick={() => {
                            setAssigningUserId(user.id);
                            setPositionId(suggested?.id ?? "");
                          }}
                        >
                          Assign to position
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
