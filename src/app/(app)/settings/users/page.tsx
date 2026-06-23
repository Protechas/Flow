import { PageHeader } from "@/components/layout/page-header";
import { AuditLogView } from "@/components/settings/audit-log-view";
import { UsersAdmin } from "@/components/settings/users-admin";
import { BulkUserAssignment } from "@/components/setup/bulk-user-assignment";
import { BulkInvitePanel } from "@/components/setup/bulk-invite-panel";
import { UsersNeedingSetupQueue } from "@/components/setup/users-needing-setup-queue";
import { UserSetupWizard } from "@/components/setup/user-setup-wizard";
import {
  getAuditLogAction,
  getTeamsAction,
  getUsersAction,
} from "@/app/actions/users";
import { getDepartmentUsersAction, getDepartmentsAction } from "@/app/actions/departments";
import { requirePagePermission } from "@/lib/auth/guard";
import { getReportingChain } from "@/lib/auth/team-scope";
import { listOrgPositionsAction } from "@/app/actions/positions";
import { initFlowStore } from "@/lib/data/flow-store";
import { listUnassignedUsers } from "@/lib/positions/resolver";
import { UnassignedUsersPanel } from "@/components/hierarchy/unassigned-users-panel";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isAdminConfigured } from "@/lib/supabase/admin";

export default async function UsersAdminPage() {
  await requirePagePermission("users:manage");
  const [users, teams, departments, departmentUsers, auditLog, positions] = await Promise.all([
    getUsersAction(),
    getTeamsAction(),
    getDepartmentsAction(),
    getDepartmentUsersAction(),
    getAuditLogAction(),
    listOrgPositionsAction(),
  ]);
  const managers = users.filter((u) =>
    ["super_admin", "admin", "senior_manager", "manager", "teamlead"].includes(u.role)
  );
  initFlowStore();
  const unassignedUsers = listUnassignedUsers(users, positions);
  const reportingChains = Object.fromEntries(
    users.map((u) => [u.id, getReportingChain(u.id, users)])
  );
  const supabaseAuth = isSupabaseConfigured();
  const canCreate = (supabaseAuth && isAdminConfigured()) || !supabaseAuth;

  return (
    <>
      <PageHeader
        title="User Management"
        description="Guided setup for people, roles, and reporting chains. Flow handles permissions and dashboard scope automatically."
      />
      <div className="space-y-8">
        <section id="all-users" className="space-y-3 scroll-mt-6">
          <div>
            <h2 className="text-lg font-semibold">All users</h2>
            <p className="text-sm text-muted-foreground">
              Edit profiles, set passwords, and manage access. Scroll right in the table for actions.
              Users missing hierarchy data are marked Needs setup.
            </p>
          </div>
          <UsersAdmin
            users={users}
            teams={teams}
            managers={managers}
            departments={departments}
            departmentUsers={departmentUsers}
            reportingChains={reportingChains}
            positions={positions}
            resetPasswordEnabled={supabaseAuth && isAdminConfigured()}
          />
        </section>

        {canCreate ? (
          <UserSetupWizard users={users} departments={departments} teams={teams} positions={positions} />
        ) : (
          <p className="text-sm text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            Add SUPABASE_SERVICE_ROLE_KEY to enable guided user creation.
          </p>
        )}

        <UsersNeedingSetupQueue
          users={users}
          departments={departments}
          teams={teams}
          departmentUsers={departmentUsers}
          canSetPassword={supabaseAuth && isAdminConfigured()}
        />

        {unassignedUsers.length > 0 && (
          <UnassignedUsersPanel
            users={unassignedUsers}
            positions={positions}
            departments={departments}
            teams={teams}
            allUsers={users}
            canAssign
            canManageAccounts={supabaseAuth && isAdminConfigured()}
          />
        )}

        {canCreate ? <BulkInvitePanel departments={departments} teams={teams} managers={managers} /> : null}

        <BulkUserAssignment users={users} departments={departments} teams={teams} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <AuditLogView entries={auditLog} />
        </section>
      </div>
    </>
  );
}
