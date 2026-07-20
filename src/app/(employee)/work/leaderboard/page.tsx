import { PageHeader } from "@/components/layout/page-header";
import { ScopedLeaderboard } from "@/components/performance/scoped-leaderboard";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeScorecards } from "@/lib/data/performance";
import { computeBadgesForUsers } from "@/lib/badges/badges";
import { getFlowStore, listTeamsStore } from "@/lib/data/flow-store";

const LEAD_ROLES = new Set(["teamlead", "manager", "senior_manager", "admin", "super_admin"]);

/** Read-only leaderboard — own team by default, whole company on toggle. */
export default async function EmployeeLeaderboardPage() {
  const user = await requirePageAccess("/work/leaderboard");
  const scorecards = await getEmployeeScorecards();
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
        title="Leaderboard"
        description="Flow Scores, badges, and bragging rights — updated live from real work"
      />
      <ScopedLeaderboard
        scorecards={scorecards}
        badgesByUser={badgesByUser}
        leads={leads}
        viewerTeamId={user.team_id ?? null}
        teams={listTeamsStore().map((t) => ({ id: t.id, name: t.name }))}
      />
    </>
  );
}
