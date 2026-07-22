import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, listTeamsStore } from "@/lib/data/flow-store";
import {
  buildAccountabilityReport,
  buildCoachingReport,
  buildEmployeeScorecard,
  buildTeamPerformanceDashboard,
  rankScorecards,
  type PerformanceStoreSlice,
} from "@/lib/scoring/performance-engine";
import { isProductionRosterMember } from "@/lib/users/production-roster";
import { isRankedForLeaderboards } from "@/lib/users/ranking";
import type {
  AccountabilityReport,
  CoachingReport,
  EmployeeScorecard,
  TeamPerformanceDashboard,
} from "@/types/flow";

async function getPerformanceStore(
  visibleUserIds?: Set<string>
): Promise<PerformanceStoreSlice> {
  await ensureAppDataLoaded();
  const store = getFlowStore();
  // P1 visibility contract: when a viewer scope is provided, every derived
  // number (rankings, dashboards, scorecards) is computed over those users
  // only — branch viewers never see company-wide aggregates.
  const users = visibleUserIds
    ? store.users.filter((u) => visibleUserIds.has(u.id))
    : store.users;
  return {
    users,
    teams: listTeamsStore(),
    workPackages: store.workPackages,
    timeLogs: store.timeLogs,
    qaReviews: store.qaReviews,
    activity: store.activity,
    corrections: store.corrections,
  };
}

export async function getTeamPerformanceDashboard(
  visibleUserIds?: Set<string>
): Promise<TeamPerformanceDashboard> {
  const store = await getPerformanceStore(visibleUserIds);
  // Ranking-excluded teams (operating model excludeFromRankings) never enter
  // the dashboard's ranked lists — their work isn't unit-comparable.
  return buildTeamPerformanceDashboard({
    ...store,
    users: store.users.filter(isRankedForLeaderboards),
  });
}

export async function getEmployeeScorecards(
  visibleUserIds?: Set<string>
): Promise<EmployeeScorecard[]> {
  const store = await getPerformanceStore(visibleUserIds);
  const employees = store.users.filter(
    (u) => isProductionRosterMember(u) && isRankedForLeaderboards(u)
  );
  return rankScorecards(employees.map((u) => buildEmployeeScorecard(u, store)));
}

export async function getEmployeeScorecard(
  userId: string
): Promise<EmployeeScorecard | null> {
  const store = await getPerformanceStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  // Excluded-team members still get their own scorecard — just unranked
  // (rank stays 0; the scorecard view hides the rank line for them).
  const cards = rankScorecards(
    store.users
      .filter((u) => isProductionRosterMember(u) && isRankedForLeaderboards(u))
      .map((u) => buildEmployeeScorecard(u, store))
  );
  return cards.find((c) => c.user.id === userId) ?? buildEmployeeScorecard(user, store);
}

export async function getAccountabilityReport(): Promise<AccountabilityReport> {
  const scorecards = await getEmployeeScorecards();
  return buildAccountabilityReport(scorecards);
}

export async function getCoachingReport(): Promise<CoachingReport> {
  const scorecards = await getEmployeeScorecards();
  return buildCoachingReport(scorecards);
}
