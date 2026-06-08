import { TeamPerformanceHub } from "@/components/performance/team-performance-hub";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";

export default async function PerformancePage() {
  await requirePageAccess("/performance");
  const [dashboard, scorecards] = await Promise.all([
    getTeamPerformanceDashboard(),
    getEmployeeScorecards(),
  ]);

  return (
    <>
      <PageHeader
        title="Flow Score Accountability Engine"
        description="Transparent scores from work packages, QA, corrections, activity, and time logs"
      />
      <TeamPerformanceHub dashboard={dashboard} scorecards={scorecards} />
    </>
  );
}
