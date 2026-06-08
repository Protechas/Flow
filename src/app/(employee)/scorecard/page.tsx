import { EmployeeProfileView } from "@/components/employee/employee-profile-view";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function EmployeeScorecardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dashboard = await getEmployeeDashboard(user.id);
  if (!dashboard.scorecard) redirect("/work");

  return (
    <EmployeeProfileView
      scorecard={dashboard.scorecard}
      dailySummary={dashboard.dailySummary}
    />
  );
}
