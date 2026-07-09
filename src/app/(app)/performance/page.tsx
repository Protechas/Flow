import { TeamPerformanceHub } from "@/components/performance/team-performance-hub";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import { computeBadgesForUsers } from "@/lib/badges/badges";
import { getFlowStore } from "@/lib/data/flow-store";

const LEAD_ROLES = new Set(["teamlead", "manager", "senior_manager", "admin", "super_admin"]);

export default async function PerformancePage() {
  await requirePageAccess("/performance");
  const [dashboard, scorecards] = await Promise.all([
    getTeamPerformanceDashboard(),
    getEmployeeScorecards(),
  ]);
  const leadUsers = getFlowStore().users.filter(
    (u) => u.is_active && LEAD_ROLES.has(u.role)
  );
  const badgesByUser = await computeBadgesForUsers([
    ...scorecards.map((s) => s.user.id),
    ...leadUsers.map((u) => u.id),
  ]);
  const leads = leadUsers.map((user) => ({ user, badges: badgesByUser[user.id] ?? [] }));

  return (
    <>
      <PageHeader
        title="Performance & Accountability"
        description={`Transparent ${OPS_COPY.operationsScore.toLowerCase()} from work packages, QA, corrections, activity, and time logs`}
      />
      <TeamPerformanceHub
        dashboard={dashboard}
        scorecards={scorecards}
        badgesByUser={badgesByUser}
        leads={leads}
      />
    </>
  );
}
