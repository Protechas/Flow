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
import type {
  AccountabilityReport,
  CoachingReport,
  EmployeeScorecard,
  TeamPerformanceDashboard,
} from "@/types/flow";

async function getPerformanceStore(): Promise<PerformanceStoreSlice> {
  await ensureAppDataLoaded();
  const store = getFlowStore();
  return {
    users: store.users,
    teams: listTeamsStore(),
    workPackages: store.workPackages,
    timeLogs: store.timeLogs,
    qaReviews: store.qaReviews,
    activity: store.activity,
    corrections: store.corrections,
  };
}

export async function getTeamPerformanceDashboard(): Promise<TeamPerformanceDashboard> {
  return buildTeamPerformanceDashboard(await getPerformanceStore());
}

export async function getEmployeeScorecards(): Promise<EmployeeScorecard[]> {
  const store = await getPerformanceStore();
  const employees = store.users.filter(isProductionRosterMember);
  return rankScorecards(employees.map((u) => buildEmployeeScorecard(u, store)));
}

export async function getEmployeeScorecard(
  userId: string
): Promise<EmployeeScorecard | null> {
  const store = await getPerformanceStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  const cards = rankScorecards(
    store.users.filter(isProductionRosterMember).map((u) => buildEmployeeScorecard(u, store))
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
