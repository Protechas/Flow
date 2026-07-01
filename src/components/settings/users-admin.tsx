"use client";

import { useState, useTransition } from "react";
import {
  adminDeleteUserAction,
  adminResetPasswordAction,
  setUserActiveAction,
} from "@/app/actions/users";
import { UserProfileEditor } from "@/components/settings/user-profile-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getOrganizationalPosition,
  getSystemAccessLevel,
} from "@/lib/auth/access-level";
import { SYSTEM_ACCESS_LEVELS } from "@/lib/constants";
import { POSITION_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { getUserSetupStatus } from "@/lib/setup/needs-setup";
import { employmentStatusLabel } from "@/lib/users/profile-validation";
import { formatActionError } from "@/lib/errors/action-messages";
import { userDisplayInitials } from "@/lib/users/format";
import type {
  Department,
  DepartmentUser,
  OrgPosition,
  Team,
  User,
} from "@/types/flow";
import { MoreHorizontal, Pencil, Shield, Trash2, UserMinus, UserPlus } from "lucide-react";

type EditorMode = "edit" | "access" | "account" | "position";

export function UsersAdmin({
  users,
  teams,
  managers,
  departments,
  departmentUsers,
  positions = [],
  resetPasswordEnabled = false,
}: {
  users: User[];
  teams: Team[];
  managers: User[];
  departments: Department[];
  departmentUsers: DepartmentUser[];
  positions?: OrgPosition[];
  resetPasswordEnabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorUser, setEditorUser] = useState<User | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");

  function openEditor(user: User, mode: EditorMode = "edit") {
    setEditorMode(mode);
    setEditorUser(user);
  }

  function run(action: () => Promise<unknown>, successMessage = "Saved") {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(successMessage);
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  function confirmDeleteUser(user: User) {
    const ok = window.confirm(
      `Permanently delete ${user.full_name} (${user.email})?\n\nThis removes their login and profile. You can invite the same email again afterward.`
    );
    if (!ok) return;
    run(
      () => adminDeleteUserAction(user.id),
      `${user.full_name} deleted. You can create a fresh account with the same email.`
    );
  }

  function managerName(user: User): string {
    if (!user.manager_id) return "—";
    return managers.find((m) => m.id === user.manager_id)?.full_name ?? "—";
  }

  function teamName(user: User): string {
    if (!user.team_id) return "—";
    return teams.find((t) => t.id === user.team_id)?.name ?? "—";
  }

  function positionLabel(user: User): string {
    if (user.assigned_position_id) {
      const seat = positions.find((p) => p.id === user.assigned_position_id);
      if (seat?.title) return seat.title;
    }
    return POSITION_DISPLAY_LABELS[getOrganizationalPosition(user)];
  }

  function accessLabel(user: User): string {
    const level = getSystemAccessLevel(user);
    return SYSTEM_ACCESS_LEVELS.find((l) => l.value === level)?.label ?? level;
  }

  function statusBadge(user: User) {
    const setupStatus = getUserSetupStatus(user, departmentUsers, teams);
    const employment = user.employment_status ?? "active";

    return (
      <div className="flex flex-col gap-1 items-start">
        <Badge
          variant="outline"
          className={
            user.is_active
              ? "text-emerald-400 border-emerald-500/30"
              : "text-red-400 border-red-500/30"
          }
        >
          {user.is_active ? "Active" : "Disabled"}
        </Badge>
        {employment !== "active" && (
          <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
            {employmentStatusLabel(employment)}
          </Badge>
        )}
        {setupStatus === "needs_setup" && (
          <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
            Needs setup
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium">Name</th>
              <th className="text-left py-3 px-4 font-medium">Email</th>
              <th className="text-left py-3 px-4 font-medium">Position</th>
              <th className="text-left py-3 px-4 font-medium">Team</th>
              <th className="text-left py-3 px-4 font-medium">Supervisor</th>
              <th className="text-left py-3 px-4 font-medium">Access</th>
              <th className="text-left py-3 px-4 font-medium">Status</th>
              <th className="text-right py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className={pending ? "opacity-60" : ""}>
            {users.map((user) => (
              <tr
                key={user.id}
                id={`user-${user.id}`}
                className="border-t border-border/40 align-middle scroll-mt-24"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5 min-w-[10rem]">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold shrink-0">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        userDisplayInitials(user)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.full_name}</p>
                      {user.job_title && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {user.job_title}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                <td className="py-3 px-4">{positionLabel(user)}</td>
                <td className="py-3 px-4 text-muted-foreground">{teamName(user)}</td>
                <td className="py-3 px-4 text-muted-foreground">{managerName(user)}</td>
                <td className="py-3 px-4">{accessLabel(user)}</td>
                <td className="py-3 px-4">{statusBadge(user)}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => openEditor(user, "edit")}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label={`More actions for ${user.full_name}`}
                          />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEditor(user, "access")}>
                          <Shield className="h-3.5 w-3.5 mr-2" />
                          Manage access
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditor(user, "position")}>
                          <UserPlus className="h-3.5 w-3.5 mr-2" />
                          Assign position
                        </DropdownMenuItem>
                        {resetPasswordEnabled && (
                          <DropdownMenuItem onClick={() => openEditor(user, "account")}>
                            Reset password / invite
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            run(
                              () => setUserActiveAction(user.id, !user.is_active),
                              user.is_active ? "User deactivated." : "User reactivated."
                            )
                          }
                        >
                          <UserMinus className="h-3.5 w-3.5 mr-2" />
                          {user.is_active ? "Deactivate user" : "Reactivate user"}
                        </DropdownMenuItem>
                        {resetPasswordEnabled && (
                          <DropdownMenuItem
                            onClick={() =>
                              run(
                                () => adminResetPasswordAction(user.id, user.email),
                                "Password reset email sent."
                              )
                            }
                          >
                            Send reset email
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => confirmDeleteUser(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete user permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <UserProfileEditor
        user={editorUser}
        users={users}
        teams={teams}
        departments={departments}
        departmentUsers={departmentUsers}
        positions={positions}
        managers={managers}
        open={Boolean(editorUser)}
        onOpenChange={(open) => !open && setEditorUser(null)}
        resetPasswordEnabled={resetPasswordEnabled}
        initialSection={
          editorMode === "access"
            ? "access"
            : editorMode === "account"
              ? "account"
              : editorMode === "position"
                ? "organization"
                : undefined
        }
      />
    </div>
  );
}
