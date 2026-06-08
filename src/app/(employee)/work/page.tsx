import { EmployeeHome } from "@/components/employee/employee-home";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";

export default async function EmployeeWorkPage() {
  const user = await requirePageAccess("/work");
  const dashboard = await getEmployeeDashboard(user.id);

  return <EmployeeHome dashboard={dashboard} userName={user.full_name} />;
}
