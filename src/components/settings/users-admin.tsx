"use client";

import { useState, useTransition } from "react";
import {
  adminResetPasswordAction,
  setUserActiveAction,
  updateUserDetailsAction,
  updateUserRoleAction,
} from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLES } from "@/lib/constants";
import type { Team, User, UserRole } from "@/types/flow";
import { userDisplayInitials } from "@/lib/users/format";

export function UsersAdmin({
  users,
  teams,
  managers,
}: {
  users: User[];
  teams: Team[];
  managers: User[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setMessage("Saved");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-3 px-3 font-medium">User</th>
              <th className="text-left py-3 px-3 font-medium">Email</th>
              <th className="text-left py-3 px-3 font-medium">Role</th>
              <th className="text-left py-3 px-3 font-medium">Team</th>
              <th className="text-left py-3 px-3 font-medium">Manager</th>
              <th className="text-left py-3 px-3 font-medium">Status</th>
              <th className="text-left py-3 px-3 font-medium">Last login</th>
              <th className="text-right py-3 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className={pending ? "opacity-60" : ""}>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                teams={teams}
                managers={managers}
                onSave={(data) =>
                  run(() => updateUserDetailsAction(u.id, data))
                }
                onRole={(role) => run(() => updateUserRoleAction(u.id, role))}
                onToggleActive={(active) =>
                  run(() => setUserActiveAction(u.id, active))
                }
                onResetPassword={() =>
                  run(() => adminResetPasswordAction(u.id, u.email))
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function UserRow({
  user,
  teams,
  managers,
  onSave,
  onRole,
  onToggleActive,
  onResetPassword,
}: {
  user: User;
  teams: Team[];
  managers: User[];
  onSave: (data: Parameters<typeof updateUserDetailsAction>[1]) => void;
  onRole: (role: UserRole) => void;
  onToggleActive: (active: boolean) => void;
  onResetPassword: () => void;
}) {
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [hireDate, setHireDate] = useState(user.hire_date ?? "");

  return (
    <tr className="border-t border-border/40 align-top">
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-semibold shrink-0">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              userDisplayInitials(user)
            )}
          </div>
          <div className="space-y-1 min-w-[120px]">
            <Input
              className="h-7 text-xs"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="First"
            />
            <Input
              className="h-7 text-xs"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Last"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-1"
              onClick={() =>
                onSave({
                  first_name: first,
                  last_name: last,
                  hire_date: hireDate || null,
                })
              }
            >
              Save name
            </Button>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-muted-foreground">{user.email}</td>
      <td className="py-3 px-3">
        <Select value={user.role} onValueChange={(v) => v && onRole(v as UserRole)}>
          <SelectTrigger className="w-[120px] h-8">
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
      </td>
      <td className="py-3 px-3">
        <Select
          value={user.team_id ?? ""}
          onValueChange={(v) => onSave({ team_id: v || null })}
        >
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 px-3">
        <Select
          value={user.manager_id ?? ""}
          onValueChange={(v) => onSave({ manager_id: v === "__none__" ? null : v })}
        >
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue placeholder="Manager" />
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
        <Input
          type="date"
          className="h-7 text-xs mt-1 w-[130px]"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
          onBlur={() => onSave({ hire_date: hireDate || null })}
        />
      </td>
      <td className="py-3 px-3">
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
      </td>
      <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
        {user.last_login_at
          ? new Date(user.last_login_at).toLocaleString()
          : "Never"}
      </td>
      <td className="py-3 px-3 text-right space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => onToggleActive(!user.is_active)}
        >
          {user.is_active ? "Disable" : "Reactivate"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={onResetPassword}
        >
          Reset password
        </Button>
      </td>
    </tr>
  );
}
