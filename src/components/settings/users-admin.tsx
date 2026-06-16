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
import { EmployeePayTypeSelect } from "@/components/people/employee-pay-type-select";
import { USER_ROLES } from "@/lib/constants";
import { UserSetupDialog } from "@/components/setup/user-setup-dialog";
import { getUserSetupStatus } from "@/lib/setup/needs-setup";
import type { Department, DepartmentUser, ReportingChainEntry, Team, User, UserRole } from "@/types/flow";
import { userDisplayInitials } from "@/lib/users/format";

export function UsersAdmin({
  users,
  teams,
  managers,
  departments,
  departmentUsers,
  reportingChains,
  resetPasswordEnabled = false,
}: {
  users: User[];
  teams: Team[];
  managers: User[];
  departments: Department[];
  departmentUsers: DepartmentUser[];
  reportingChains: Record<string, ReportingChainEntry[]>;
  resetPasswordEnabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupUser, setSetupUser] = useState<User | null>(null);

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
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-3 px-3 font-medium">User</th>
              <th className="text-left py-3 px-3 font-medium">Email</th>
              <th className="text-left py-3 px-3 font-medium">Role</th>
              <th className="text-left py-3 px-3 font-medium">Pay type</th>
              <th className="text-left py-3 px-3 font-medium">Team</th>
              <th className="text-left py-3 px-3 font-medium">Supervisor</th>
              <th className="text-left py-3 px-3 font-medium">Reporting chain</th>
              <th className="text-left py-3 px-3 font-medium">Branch access</th>
              <th className="text-left py-3 px-3 font-medium">Setup</th>
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
                reportingChain={reportingChains[u.id] ?? []}
                setupStatus={getUserSetupStatus(u, departmentUsers, teams)}
                onCompleteSetup={() => setSetupUser(u)}
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
                resetPasswordEnabled={resetPasswordEnabled}
              />
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {setupUser && (
        <UserSetupDialog
          open={Boolean(setupUser)}
          onOpenChange={(open) => !open && setSetupUser(null)}
          user={setupUser}
          users={users}
          departments={departments}
          teams={teams}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  teams,
  managers,
  reportingChain,
  setupStatus,
  onCompleteSetup,
  onSave,
  onRole,
  onToggleActive,
  onResetPassword,
  resetPasswordEnabled,
}: {
  user: User;
  teams: Team[];
  managers: User[];
  reportingChain: ReportingChainEntry[];
  setupStatus: "complete" | "needs_setup";
  onCompleteSetup: () => void;
  onSave: (data: Parameters<typeof updateUserDetailsAction>[1]) => void;
  onRole: (role: UserRole) => void;
  onToggleActive: (active: boolean) => void;
  onResetPassword: () => void;
  resetPasswordEnabled: boolean;
}) {
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [hireDate, setHireDate] = useState(user.hire_date ?? "");

  return (
    <tr className="border-t border-border/40 align-top">
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold shrink-0">
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
        {user.role === "employee" ? (
          <EmployeePayTypeSelect user={user} compact />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
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
      <td className="py-3 px-3 text-xs text-muted-foreground min-w-[140px]">
        {reportingChain.length === 0 ? (
          <span>—</span>
        ) : (
          <ul className="space-y-1">
            {reportingChain.map((entry, i) => (
              <li key={entry.user_id}>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  {i === 0 ? "Reports to" : entry.relationship.replace("_", " ")}
                </span>
                <div>{entry.full_name}</div>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-3 px-3">
        {user.role === "manager" ? (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!user.branch_view_access}
              onChange={(e) => onSave({ branch_view_access: e.target.checked })}
            />
            <span className="text-muted-foreground">Full branch</span>
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 px-3">
        {setupStatus === "needs_setup" ? (
          <div className="space-y-1">
            <Badge variant="outline" className="text-amber-400 border-amber-500/30">
              Needs setup
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs w-full"
              onClick={onCompleteSetup}
            >
              Complete setup
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
            Complete
          </Badge>
        )}
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
        {resetPasswordEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs w-full"
            onClick={onResetPassword}
          >
            Reset password
          </Button>
        ) : (
          <p className="text-[10px] text-muted-foreground leading-snug">
            Password reset requires Supabase admin configuration.
          </p>
        )}
      </td>
    </tr>
  );
}
