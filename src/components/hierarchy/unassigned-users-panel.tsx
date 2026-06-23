"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserAccountDialog } from "@/components/setup/user-account-dialog";
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
import { cn } from "@/lib/utils";
import type { OrgPosition, User } from "@/types/flow";
import { ChevronDown, UserCircle2 } from "lucide-react";

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
  teams = [],
  allUsers = [],
  canAssign,
  canManageAccounts = false,
  defaultExpanded = true,
  className,
  onAssigned,
}: {
  users: User[];
  positions: OrgPosition[];
  departments: { id: string; name: string }[];
  teams?: import("@/types/flow").Team[];
  allUsers?: User[];
  canAssign: boolean;
  canManageAccounts?: boolean;
  /** Collapsed by default on org chart; expanded on settings. */
  defaultExpanded?: boolean;
  className?: string;
  onAssigned?: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pending, startTransition] = useTransition();
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [manageUser, setManageUser] = useState<User | null>(null);
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

  function accessLabel(user: User) {
    const orgLevel = POSITION_DISPLAY_LABELS[getOrganizationalPosition(user)];
    const systemLevel = getSystemAccessLevel(user);
    return systemLevel !== "standard"
      ? `${ROLE_DISPLAY_LABELS[user.role]} · ${systemLevel}`
      : `${ROLE_DISPLAY_LABELS[user.role]} · ${orgLevel}`;
  }

  return (
    <div className={cn("rounded-xl border border-border/60 bg-card/40 p-3", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <UserCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
          <h3 className="text-sm font-semibold">Unassigned users</h3>
          <Badge variant="secondary" className="text-[10px]">
            {users.length}
          </Badge>
          {!expanded && (
            <span className="truncate text-xs text-muted-foreground">
              — not linked to an org seat
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Assign to a seat for reporting, department, and team. Use Manage account for
              passwords.
            </p>
            {canManageAccounts && (
              <Link
                href="/settings/users"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                User management →
              </Link>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <ul
            className={cn(
              "space-y-2",
              users.length > 4 && "max-h-64 overflow-y-auto pr-1"
            )}
          >
            {users.map((user) => {
              const suggested = suggestPosition(user);
              const isAssigning = assigningUserId === user.id;

              return (
                <li
                  key={user.id}
                  className="rounded-lg border border-border/40 bg-background/50 px-3 py-2"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">
                        {accessLabel(user)}
                        {suggested ? ` · ${suggested.title}` : ""}
                      </p>
                    </div>

                    <div className="hidden min-w-0 max-w-[9rem] shrink-0 sm:block">
                      <p className="truncate text-[11px] text-muted-foreground" title={accessLabel(user)}>
                        {accessLabel(user)}
                      </p>
                      <p
                        className="truncate text-[11px] text-muted-foreground/80"
                        title={suggested?.title}
                      >
                        {suggested?.title ?? "No vacant seat"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                      {canManageAccounts && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-xs"
                          onClick={() => setManageUser(user)}
                        >
                          Manage account
                        </Button>
                      )}
                      {canAssign &&
                        (isAssigning ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Select
                              value={positionId || suggested?.id || "__pick__"}
                              onValueChange={(v) =>
                                setPositionId(!v || v === "__pick__" ? "" : v)
                              }
                            >
                              <SelectTrigger className="h-7 w-[min(11rem,100%)] text-xs">
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
                              className="h-7 px-2 text-xs"
                              disabled={pending || !(positionId || suggested?.id)}
                              onClick={() => assign(user.id, positionId || suggested!.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
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
                            className="h-7 px-2 text-xs"
                            disabled={vacantPositions.length === 0}
                            onClick={() => {
                              setAssigningUserId(user.id);
                              setPositionId(suggested?.id ?? "");
                            }}
                          >
                            Assign
                          </Button>
                        ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {manageUser && (
        <UserAccountDialog
          user={manageUser}
          users={allUsers.length ? allUsers : users}
          departments={departments as import("@/types/flow").Department[]}
          teams={teams}
          positions={positions}
          canSetPassword={canManageAccounts}
          open={Boolean(manageUser)}
          onOpenChange={(open) => !open && setManageUser(null)}
        />
      )}
    </div>
  );
}
