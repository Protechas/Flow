import type { EmployeeScorecard, FlowAchievement, FlowBadge } from "@/types/flow";

export function computeBadges(scorecard: EmployeeScorecard): FlowBadge[] {
  const m = scorecard.metrics;
  const reviewCount = scorecard.recentQaFeedback.length;

  return [
    {
      id: "qa_master",
      name: "QA Master",
      description: "100% QA pass rate with 5+ reviews",
      icon: "ShieldCheck",
      earned: m.qaPassRate === 100 && reviewCount >= 5,
      earnedReason:
        m.qaPassRate === 100 && reviewCount >= 5
          ? `${reviewCount} reviews, all passed`
          : undefined,
    },
    {
      id: "speed_demon",
      name: "Speed Demon",
      description: "10+ packages completed this week",
      icon: "Zap",
      earned: scorecard.completedThisWeek >= 10,
      earnedReason:
        scorecard.completedThisWeek >= 10
          ? `${scorecard.completedThisWeek} completed this week`
          : undefined,
    },
    {
      id: "consistent_performer",
      name: "Consistent Performer",
      description: "No overdue work and stable 30-day score",
      icon: "Award",
      earned: isConsistentPerformer(scorecard),
      earnedReason: isConsistentPerformer(scorecard)
        ? "Zero overdue items with stable Flow Score trend"
        : undefined,
    },
    {
      id: "correction_crusher",
      name: "Correction Crusher",
      description: "Resolved all assigned corrections",
      icon: "CheckCircle2",
      earned:
        m.correctionsReceived > 0 &&
        m.correctionsResolved >= m.correctionsReceived &&
        m.openCorrections === 0,
      earnedReason:
        m.correctionsResolved >= m.correctionsReceived
          ? `${m.correctionsResolved} resolved, ${m.openCorrections} open`
          : undefined,
    },
    {
      id: "engagement_champion",
      name: "Engagement Champion",
      description: "Activity score 80+",
      icon: "Activity",
      earned: scorecard.activityScore >= 80,
      earnedReason:
        scorecard.activityScore >= 80
          ? `Activity score ${scorecard.activityScore}`
          : undefined,
    },
  ];
}

function isConsistentPerformer(scorecard: EmployeeScorecard): boolean {
  if (scorecard.metrics.overdueWork > 0) return false;
  if (scorecard.trend30.length < 7) return scorecard.metrics.overdueWork === 0;
  const delta =
    scorecard.trend30[scorecard.trend30.length - 1].flowScore -
    scorecard.trend30[0].flowScore;
  return delta >= -8;
}

export function computeAchievements(scorecard: EmployeeScorecard): FlowAchievement[] {
  return computeBadges(scorecard)
    .filter((b) => b.earned)
    .map((b) => ({
      id: b.id,
      title: b.name,
      description: b.description,
      earnedAt: new Date().toISOString(),
    }));
}
