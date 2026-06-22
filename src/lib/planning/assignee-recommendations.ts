import { getAssignableUserIds } from "@/lib/hierarchy/visibility-core";
import { evaluateEmployeeWorkload } from "@/lib/workload-alerts/calculator";
import { listHelpFlagRecords } from "@/lib/help-flags/store";
import type { AssigneeRecommendation, TaskImpactDraft } from "@/lib/planning/types";
import type { ForecastSettings, User, WorkPackage } from "@/types/flow";

export interface AssigneeLiveHints {
  activityGapUserIds?: string[];
  clockedInWithoutTimerUserIds?: string[];
}

export function recommendAssignees(
  draft: TaskImpactDraft,
  viewer: User,
  users: User[],
  packages: WorkPackage[],
  settings: ForecastSettings,
  limit = 5,
  workloadThresholdHours = 2,
  liveHints?: AssigneeLiveHints
): AssigneeRecommendation[] {
  const candidates = getAssignableUserIds(viewer, users).filter((id) => {
    const u = users.find((x) => x.id === id);
    return Boolean(u?.is_active);
  });

  const threshold = workloadThresholdHours;
  const openFlags = listHelpFlagRecords().filter((f) => f.status === "open" || f.status === "in_progress");
  const gapIds = new Set(liveHints?.activityGapUserIds ?? []);
  const clockedIdleIds = new Set(liveHints?.clockedInWithoutTimerUserIds ?? []);

  const scored = candidates
    .map((userId) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return null;

      const snapshot = evaluateEmployeeWorkload(user, packages, settings);
      const remaining = snapshot.remainingHours ?? 0;
      const hasHelp = openFlags.some((f) => f.employee_id === userId);

      let score = 100;
      const reasons: string[] = [];

      if (gapIds.has(userId)) {
        score -= 35;
        reasons.push("activity gap — no active work record while clocked in");
      }
      if (clockedIdleIds.has(userId)) {
        score -= 20;
        reasons.push("clocked in without active task timer");
      }

      if (snapshot.needsEstimate && snapshot.openAssigned.length > 0) {
        score -= 15;
        reasons.push("has work needing estimates");
      }
      if (remaining > threshold * 2) {
        score -= Math.min(40, Math.round((remaining - threshold) * 8));
        reasons.push(`${remaining.toFixed(1)}h remaining assigned work`);
      } else if (remaining < threshold) {
        score += 20;
        reasons.push("available capacity for additional work");
      } else {
        reasons.push("balanced current workload");
      }
      if (hasHelp) {
        score -= 25;
        reasons.push("open escalation on record");
      }
      if (snapshot.activeTaskAlmostComplete) {
        score += 10;
        reasons.push("active task nearly complete");
      }

      return {
        userId,
        name: user.full_name,
        score: Math.max(0, Math.min(100, score)),
        remainingHours: snapshot.remainingHours,
        reasoning: reasons.join("; "),
        isPrimary: false,
      };
    })
    .filter((x): x is AssigneeRecommendation => x != null)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const result = scored.slice(0, limit);
  result[0] = { ...result[0], isPrimary: true };
  return result;
}
