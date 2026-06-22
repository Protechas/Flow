import { TeamPerformanceHub } from "@/components/performance/team-performance-hub";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
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
        title="Performance & Accountability"
        description={`Transparent ${OPS_COPY.operationsScore.toLowerCase()} from work packages, QA, corrections, activity, and time logs`}
      />
      <TeamPerformanceHub dashboard={dashboard} scorecards={scorecards} />
    </>
  );
}
