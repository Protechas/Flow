import { TeamPerformanceHub } from "@/components/performance/team-performance-hub";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import { computeBadgesForUsers } from "@/lib/badges/badges";
import { getFlowStore, listTeamsStore } from "@/lib/data/flow-store";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getVisibleUserIds, isHierarchyOrgWide } from "@/lib/hierarchy/visibility-core";

const LEAD_ROLES = new Set(["teamlead", "manager", "senior_manager", "admin", "super_admin"]);

export default async function PerformancePage() {
  const user = await requirePageAccess("/performance");
  await ensureAppDataLoaded();
  const store = getFlowStore();
  // P1 visibility contract: branch viewers get dashboards computed over
  // their own people only; org-wide viewers keep the company view.
  const visibleUserIds = isHierarchyOrgWide(user)
    ? undefined
    : new Set(getVisibleUserIds(user, store.users, listTeamsStore()));
  const [dashboard, scorecards] = await Promise.all([
    getTeamPerformanceDashboard(visibleUserIds),
    getEmployeeScorecards(visibleUserIds),
  ]);
  const leadUsers = store.users.filter(
    (u) =>
      u.is_active &&
      LEAD_ROLES.has(u.role) &&
      (!visibleUserIds || visibleUserIds.has(u.id))
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
        viewerTeamId={user.team_id ?? null}
        teams={listTeamsStore().map((t) => ({ id: t.id, name: t.name }))}
      />
    </>
  );
}
