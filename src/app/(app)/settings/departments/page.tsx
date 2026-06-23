import { PageHeader } from "@/components/layout/page-header";
import { DepartmentStructureView } from "@/components/departments/department-structure-view";
import { DepartmentStructureWizard } from "@/components/departments/department-structure-wizard";
import { UnassignedDepartmentUsersPanel } from "@/components/departments/unassigned-department-users-panel";
import { DepartmentsAdmin } from "@/components/settings/departments-admin";
import {
  getDepartmentUsersAction,
  getDepartmentsAction,
  getTeamsAction,
} from "@/app/actions/departments";
import { requirePagePermission } from "@/lib/auth/guard";
import {
  buildDepartmentStructure,
  countVacantDepartmentSlots,
  listUnassignedDepartmentUsers,
} from "@/lib/departments/structure";
import { initFlowStore } from "@/lib/data/flow-store";
import { listUsers } from "@/lib/data/users";

export default async function DepartmentsSettingsPage() {
  await requirePagePermission("departments:manage");
  initFlowStore();
  const [departments, teams, departmentUsers, users] = await Promise.all([
    getDepartmentsAction(),
    getTeamsAction(),
    getDepartmentUsersAction(),
    listUsers(),
  ]);

  const structure = buildDepartmentStructure(departments, teams, users, departmentUsers);
  const unassignedUsers = listUnassignedDepartmentUsers(users, departmentUsers);
  const vacantSlotCount = countVacantDepartmentSlots(
    departments.filter((d) => d.status === "active"),
    teams
  );

  const managers = users.filter((u) =>
    ["super_admin", "admin", "senior_manager", "manager", "teamlead"].includes(u.role)
  );

  return (
    <>
      <PageHeader
        title="Departments"
        description="Build department and team structure first, then assign leaders and members when ready."
      />
      <div className="space-y-8">
        <DepartmentStructureWizard users={users} />

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Department structure</h2>
            <p className="text-sm text-muted-foreground">
              Vacant leadership slots are highlighted. Use Manage to edit, assign, or delete departments and teams.
            </p>
          </div>
          <DepartmentStructureView
            structure={structure}
            teams={teams}
            users={users}
            vacantSlotCount={vacantSlotCount}
            canManage
          />
        </section>

        {unassignedUsers.length > 0 && (
          <UnassignedDepartmentUsersPanel
            users={unassignedUsers}
            departments={departments}
            teams={teams}
            canAssign
          />
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Manage departments</h2>
            <p className="text-sm text-muted-foreground">
              Edit names, archive departments, and quick-create shells.
            </p>
          </div>
          <DepartmentsAdmin departments={departments} managers={managers} />
        </section>
      </div>
    </>
  );
}
