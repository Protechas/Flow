"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAccountDialog } from "@/components/setup/user-account-dialog";
import { UserSetupDialog } from "@/components/setup/user-setup-dialog";
import { getAccountSetupSummary } from "@/lib/setup/account";
import { USER_ROLES } from "@/lib/constants";
import type { Department, DepartmentUser, Team, User } from "@/types/flow";
import { format } from "date-fns";
import { UserCog } from "lucide-react";

export function UsersNeedingSetupQueue({
  users,
  departments,
  teams,
  departmentUsers,
  canSetPassword = false,
}: {
  users: User[];
  departments: Department[];
  teams: Team[];
  departmentUsers: DepartmentUser[];
  canSetPassword?: boolean;
}) {
  const [setupUser, setSetupUser] = useState<User | null>(null);
  const [manageUser, setManageUser] = useState<User | null>(null);

  const needingSetup = users
    .map((user) => ({
      user,
      summary: getAccountSetupSummary(user, departmentUsers, teams),
    }))
    .filter(({ summary }) => summary.setupStatus === "needs_setup");

  if (!needingSetup.length) {
    return (
      <div className="enterprise-panel p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <UserCog className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold">Users needing setup</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              All users have completed department, team, and supervisor assignment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="enterprise-panel overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <UserCog className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold">Users needing setup</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                New accounts start as employees with limited access until setup is complete.
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Name</th>
                <th className="text-left py-3 px-4 font-medium">Email</th>
                <th className="text-left py-3 px-4 font-medium">Created</th>
                <th className="text-left py-3 px-4 font-medium">Role</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Missing</th>
                <th className="text-right py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {needingSetup.map(({ user, summary }) => (
                <tr key={user.id} className="border-t border-border/40">
                  <td className="py-3 px-4 font-medium">{user.full_name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {format(new Date(user.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="py-3 px-4">
                    {USER_ROLES.find((r) => r.value === user.role)?.label ?? user.role}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                      Needs setup
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {summary.missingFields.join(" · ") || "—"}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setManageUser(user)}>
                      Manage account
                    </Button>
                    <Button size="sm" onClick={() => setSetupUser(user)}>
                      Complete setup
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

      {manageUser && (
        <UserAccountDialog
          user={manageUser}
          users={users}
          departments={departments}
          teams={teams}
          departmentUsers={departmentUsers}
          canSetPassword={canSetPassword}
          open={Boolean(manageUser)}
          onOpenChange={(open) => !open && setManageUser(null)}
        />
      )}
    </>
  );
}
