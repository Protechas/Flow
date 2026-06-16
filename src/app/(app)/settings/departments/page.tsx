import { PageHeader } from "@/components/layout/page-header";
import { DepartmentsAdmin } from "@/components/settings/departments-admin";
import { DepartmentSetupWizard } from "@/components/setup/department-setup-wizard";
import { requirePagePermission } from "@/lib/auth/guard";
import { listDepartments } from "@/lib/data/flow-store";
import { listUsers } from "@/lib/data/users";

export default async function DepartmentsSettingsPage() {
  await requirePagePermission("departments:manage");
  const [departments, users] = await Promise.all([listDepartments(), listUsers()]);

  return (
    <>
      <PageHeader
        title="Departments"
        description="Guided department setup — name your branch, assign leadership, and place teams. Flow builds reporting chains and alert routing behind the scenes."
      />
      <div className="space-y-8">
        <DepartmentSetupWizard users={users} />

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Manage departments</h2>
            <p className="text-sm text-muted-foreground">
              Edit names, leads, and archive status for existing departments.
            </p>
          </div>
          <DepartmentsAdmin
            departments={departments}
            managers={users.filter((u) =>
              ["super_admin", "admin", "senior_manager", "manager", "teamlead"].includes(u.role)
            )}
          />
        </section>
      </div>
    </>
  );
}
