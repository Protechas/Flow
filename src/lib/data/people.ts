import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { MOCK_TEAM } from "@/lib/data/mock-data";
import {
  buildEmployeeScorecard,
  rankScorecards,
  type PerformanceStoreSlice,
} from "@/lib/scoring/performance-engine";
import { buildTeamScorecardSummary } from "@/lib/scoring/scorecard-periods";
import type { EmployeeScorecard, TeamScorecardSummary } from "@/types/flow";

function getPerformanceStore(): PerformanceStoreSlice {
  initFlowStore();
  const store = getFlowStore();
  return {
    users: store.users,
    teams: [MOCK_TEAM],
    workPackages: store.workPackages,
    timeLogs: store.timeLogs,
    qaReviews: store.qaReviews,
    activity: store.activity,
    corrections: store.corrections,
  };
}

export async function getPeopleProfiles(): Promise<EmployeeScorecard[]> {
  const store = getPerformanceStore();
  const employees = store.users.filter((u) => u.role === "employee" && u.is_active);
  return rankScorecards(employees.map((u) => buildEmployeeScorecard(u, store)));
}

export async function getPeopleProfile(userId: string): Promise<EmployeeScorecard | null> {
  const scorecards = await getPeopleProfiles();
  return scorecards.find((p) => p.user.id === userId) ?? null;
}

export async function getTeamScorecardSummary(): Promise<TeamScorecardSummary> {
  const scorecards = await getPeopleProfiles();
  return buildTeamScorecardSummary(scorecards);
}
