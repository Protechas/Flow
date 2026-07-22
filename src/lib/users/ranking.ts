import { resolveOperatingModelForTeam } from "@/lib/operating-models/resolve";
import type { User } from "@/types/flow";

/**
 * Whether this user participates in cross-employee rankings (leaderboards,
 * accountability/coaching queues, dashboard rank lists). Teams whose
 * operating model sets excludeFromRankings opt their people out — their
 * work isn't unit-comparable, so head-to-head ranking is noise. Excluded
 * users keep their own scorecard and all time-clock behavior.
 */
export function isRankedForLeaderboards(user: Pick<User, "team_id">): boolean {
  if (!user.team_id) return true;
  return resolveOperatingModelForTeam(user.team_id).excludeFromRankings !== true;
}
