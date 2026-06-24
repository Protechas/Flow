import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, listTeamsStore } from "@/lib/data/flow-store";
import {
  buildEmployeeScorecard,
  rankScorecards,
  type PerformanceStoreSlice,
} from "@/lib/scoring/performance-engine";
import { buildTeamScorecardSummary } from "@/lib/scoring/scorecard-periods";
import { isProductionEmployee } from "@/lib/users/production-roster";
import type { EmployeeScorecard, TeamScorecardSummary, User } from "@/types/flow";

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

export async function getPeopleProfiles(teamMemberIds?: string[]): Promise<EmployeeScorecard[]> {
  const store = await getPerformanceStore();
  let employees = store.users.filter(isProductionEmployee);
  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    employees = employees.filter((u) => ids.has(u.id));
  }
  return rankScorecards(employees.map((u) => buildEmployeeScorecard(u, store)));
}

export async function getPeopleProfile(userId: string): Promise<EmployeeScorecard | null> {
  const store = await getPerformanceStore();
  const user = store.users.find((u) => u.id === userId && u.is_active);
  if (!user) return null;

  const scorecards = await getPeopleProfiles();
  const existing = scorecards.find((p) => p.user.id === userId);
  if (existing) return existing;

  return buildEmployeeScorecard(user, store);
}

export async function getTeamScorecardSummary(teamMemberIds?: string[]): Promise<TeamScorecardSummary> {
  const scorecards = await getPeopleProfiles(teamMemberIds);
  return buildTeamScorecardSummary(scorecards);
}

export function getAnalystsForScope(allUsers: User[], teamMemberIds?: string[]): User[] {
  let analysts = allUsers.filter(isProductionEmployee);
  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    analysts = analysts.filter((u) => ids.has(u.id));
  }
  return analysts;
}
