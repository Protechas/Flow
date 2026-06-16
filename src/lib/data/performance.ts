import { getFlowStore, initFlowStore, listTeamsStore } from "@/lib/data/flow-store";
import {
  buildAccountabilityReport,
  buildCoachingReport,
  buildEmployeeScorecard,
  buildTeamPerformanceDashboard,
  rankScorecards,
  type PerformanceStoreSlice,
} from "@/lib/scoring/performance-engine";
import type {
  AccountabilityReport,
  CoachingReport,
  EmployeeScorecard,
  TeamPerformanceDashboard,
} from "@/types/flow";

function getPerformanceStore(): PerformanceStoreSlice {
  initFlowStore();
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
  return buildTeamPerformanceDashboard(getPerformanceStore());
}

export async function getEmployeeScorecards(): Promise<EmployeeScorecard[]> {
  const store = getPerformanceStore();
  const employees = store.users.filter((u) => u.role === "employee" && u.is_active);
  return rankScorecards(employees.map((u) => buildEmployeeScorecard(u, store)));
}

export async function getEmployeeScorecard(
  userId: string
): Promise<EmployeeScorecard | null> {
  const store = getPerformanceStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  const cards = rankScorecards(
    store.users
      .filter((u) => u.role === "employee" && u.is_active)
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
