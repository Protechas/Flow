import { EmployeeProfileView } from "@/components/employee/employee-profile-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";
import { redirect } from "next/navigation";

export default async function EmployeeScorecardPage() {
  const user = await requirePageAccess("/scorecard");

  const dashboard = await getEmployeeDashboard(user.id);
  if (!dashboard.scorecard) redirect("/work");

  return (
    <EmployeeProfileView
      scorecard={dashboard.scorecard}
      dailySummary={dashboard.dailySummary}
    />
  );
}
