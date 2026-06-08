import { CreateUserForm } from "@/components/auth/create-user-form";
import { InviteUserForm } from "@/components/auth/invite-user-form";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogView } from "@/components/settings/audit-log-view";
import { UsersAdmin } from "@/components/settings/users-admin";
import {
  getAuditLogAction,
  getTeamsAction,
  getUsersAction,
} from "@/app/actions/users";
import { requirePagePermission } from "@/lib/auth/guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isAdminConfigured } from "@/lib/supabase/admin";

export default async function UsersAdminPage() {
  await requirePagePermission("users:manage");
  const [users, teams, auditLog] = await Promise.all([
    getUsersAction(),
    getTeamsAction(),
    getAuditLogAction(),
  ]);
  const managers = users.filter((u) => ["admin", "manager"].includes(u.role));
  const supabaseAuth = isSupabaseConfigured();

  return (
    <>
      <PageHeader
        title="User Management"
        description="Invite, create, disable, and assign roles. Admin only."
      />
      <div className="space-y-8">
        {(supabaseAuth && isAdminConfigured()) || !supabaseAuth ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <InviteUserForm teams={teams} managers={managers} />
            <CreateUserForm teams={teams} managers={managers} />
          </div>
        ) : (
          <p className="text-sm text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            Add SUPABASE_SERVICE_ROLE_KEY to enable invites and manual user creation.
          </p>
        )}
        <UsersAdmin users={users} teams={teams} managers={managers} />
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <AuditLogView entries={auditLog} />
        </section>
      </div>
    </>
  );
}
