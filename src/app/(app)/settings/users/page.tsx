import { PageHeader } from "@/components/layout/page-header";
import { AuditLogView } from "@/components/settings/audit-log-view";
import { UsersAdmin } from "@/components/settings/users-admin";
import { BulkUserAssignment } from "@/components/setup/bulk-user-assignment";
import { UserSetupWizard } from "@/components/setup/user-setup-wizard";
import {
  getAuditLogAction,
  getTeamsAction,
  getUsersAction,
} from "@/app/actions/users";
import { getDepartmentUsersAction, getDepartmentsAction } from "@/app/actions/departments";
import { requirePagePermission } from "@/lib/auth/guard";
import { getReportingChain } from "@/lib/auth/team-scope";
import { initFlowStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isAdminConfigured } from "@/lib/supabase/admin";

export default async function UsersAdminPage() {
  await requirePagePermission("users:manage");
  const [users, teams, departments, departmentUsers, auditLog] = await Promise.all([
    getUsersAction(),
    getTeamsAction(),
    getDepartmentsAction(),
    getDepartmentUsersAction(),
    getAuditLogAction(),
  ]);
  const managers = users.filter((u) =>
    ["super_admin", "admin", "senior_manager", "manager", "teamlead"].includes(u.role)
  );
  initFlowStore();
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
        {canCreate ? (
          <UserSetupWizard users={users} departments={departments} teams={teams} />
        ) : (
          <p className="text-sm text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            Add SUPABASE_SERVICE_ROLE_KEY to enable guided user creation.
          </p>
        )}

        <BulkUserAssignment users={users} departments={departments} teams={teams} />

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">All users</h2>
            <p className="text-sm text-muted-foreground">
              Advanced editing for existing users. Users missing hierarchy data are marked Needs setup.
            </p>
          </div>
          <UsersAdmin
            users={users}
            teams={teams}
            managers={managers}
            departments={departments}
            departmentUsers={departmentUsers}
            reportingChains={reportingChains}
            resetPasswordEnabled={supabaseAuth && isAdminConfigured()}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <AuditLogView entries={auditLog} />
        </section>
      </div>
    </>
  );
}
