import { EmployeeProfileView } from "@/components/employee/employee-profile-view";
import { EmployeeDailySummaryBar } from "@/components/employee/employee-daily-summary";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";

export default async function EmployeeScorecardPage() {
  const user = await requirePageAccess("/scorecard");

  const dashboard = await getEmployeeDashboard(user.id);

  // No silent redirect: an account without production history (new hires,
  // managers in employee preview) still gets the page with today's numbers
  // and an explanation instead of bouncing back to /work.
  if (!dashboard.scorecard) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">My Scorecard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal performance metrics build from production work — none is recorded for this
            account yet. Today&apos;s numbers below start counting as soon as work does.
          </p>
        </div>
        <EmployeeDailySummaryBar summary={dashboard.dailySummary} />
      </div>
    );
  }

  return (
    <EmployeeProfileView
      scorecard={dashboard.scorecard}
      dailySummary={dashboard.dailySummary}
    />
  );
}
