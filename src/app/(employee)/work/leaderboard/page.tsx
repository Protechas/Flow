import { PageHeader } from "@/components/layout/page-header";
import { GamificationPanel } from "@/components/accountability/gamification-panel";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeScorecards } from "@/lib/data/performance";
import { computeBadgesForUsers } from "@/lib/badges/badges";
import { getFlowStore } from "@/lib/data/flow-store";

const LEAD_ROLES = new Set(["teamlead", "manager", "senior_manager", "admin", "super_admin"]);

/** Read-only leaderboard for the whole team — same board the managers see. */
export default async function EmployeeLeaderboardPage() {
  await requirePageAccess("/work/leaderboard");
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
      <GamificationPanel scorecards={scorecards} badgesByUser={badgesByUser} leads={leads} />
    </>
  );
}
