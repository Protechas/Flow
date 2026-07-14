import { appTodayDate } from "@/lib/datetime/timezone";
import {
  ACTION_LABELS,
  activityScoreFromPoints,
  getActionPoints,
} from "@/lib/scoring/action-weights";
import {
  completedInRange,
  completedThisMonth,
  completedThisWeek,
  completedToday,
  computeAvgCompletionHours,
  computeFlowScore,
  computeOnTimeRate,
  computeOnTimeScore,
  computeProductivityScore,
  computeQaPassRate,
  computeQualityScore,
  isOverdue,
  isStuck,
} from "@/lib/scoring/flow-score";
import {
  computeFlowScoreBreakdown,
  computeFlowScoreForPeriod,
  resolveManagerName,
  type AccountabilityDataSlice,
} from "@/lib/scoring/accountability-engine";
import { computeAchievements, computeBadges } from "@/lib/scoring/gamification";
import {
  buildMonthlyTrends,
  buildQuarterlyTrends,
  buildScorecardMetrics,
  employeeUsers as scorecardEmployeeUsers,
} from "@/lib/scoring/scorecard-periods";
import type {
  AccountabilityDashboard,
  AccountabilityEntry,
  AccountabilityFlag,
  AccountabilityReport,
  ActionContribution,
  ActivityEvent,
  CoachingInsight,
  CoachingReport,
  CoachingReportEntry,
  Correction,
  EmployeeRanking,
  EmployeeScorecard,
  FlowScoreTrendPoint,
  QaReview,
  Team,
  TeamPerformanceDashboard,
  TimeLog,
  User,
  WorkPackage,
} from "@/types/flow";
import {
  differenceInDays,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export interface PerformanceStoreSlice {
  users: User[];
  teams: Team[];
  workPackages: WorkPackage[];
  timeLogs: TimeLog[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  corrections: Correction[];
}

function toAccountabilitySlice(store: PerformanceStoreSlice): AccountabilityDataSlice {
  return {
    users: store.users,
    teams: store.teams,
    workPackages: store.workPackages,
    timeLogs: store.timeLogs,
    qaReviews: store.qaReviews,
    activity: store.activity,
    corrections: store.corrections,
  };
}

function teamAvgWeekCompletions(store: PerformanceStoreSlice): number {
  const employees = employeeUsers(store.users);
  if (employees.length === 0) return 3;
  const total = employees.reduce(
    (s, u) => s + completedThisWeek(userPackages(store, u.id)),
    0
  );
  return Math.max(1, Math.round((total / employees.length) * 10) / 10);
}

function employeeUsers(users: User[]) {
  return scorecardEmployeeUsers(users);
}

function userActivity(store: PerformanceStoreSlice, userId: string) {
  return store.activity.filter((a) => a.user_id === userId);
}

function userPackages(store: PerformanceStoreSlice, userId: string) {
  return store.workPackages.filter((p) => p.assigned_to === userId);
}

function hoursForEvent(event: ActivityEvent, logs: TimeLog[]): number | undefined {
  if (event.type !== "time_log" || !event.work_package_id) return undefined;
  const match = logs.find(
    (t) =>
      t.work_package_id === event.work_package_id &&
      t.user_id === event.user_id &&
      Math.abs(new Date(t.created_at).getTime() - new Date(event.created_at).getTime()) < 60000
  );
  return match ? Number(match.hours) : undefined;
}

export function computeActionBreakdown(
  events: ActivityEvent[],
  logs: TimeLog[],
  since?: Date
): { breakdown: ActionContribution[]; totalPoints: number } {
  const filtered = since
    ? events.filter((e) => parseISO(e.created_at) >= since)
    : events;

  const byType = new Map<string, { count: number; points: number }>();
  let totalPoints = 0;

  for (const e of filtered) {
    const pts = getActionPoints(e, hoursForEvent(e, logs));
    totalPoints += pts;
    const cur = byType.get(e.type) ?? { count: 0, points: 0 };
    byType.set(e.type, { count: cur.count + 1, points: cur.points + pts });
  }

  const breakdown: ActionContribution[] = [...byType.entries()]
    .map(([type, v]) => ({
      type: type as ActivityEvent["type"],
      label: ACTION_LABELS[type as ActivityEvent["type"]] ?? type,
      count: v.count,
      points: v.points,
    }))
    .sort((a, b) => b.points - a.points);

  return { breakdown, totalPoints };
}

export function buildDailyTrends(
  userId: string,
  store: PerformanceStoreSlice,
  days = 14
): FlowScoreTrendPoint[] {
  const slice = toAccountabilitySlice(store);
  const packages = userPackages(store, userId);
  const logs = store.timeLogs.filter((t) => t.user_id === userId);

  return Array.from({ length: days }, (_, i) => {
    const day = startOfDay(subDays(new Date(), days - 1 - i));
    const next = startOfDay(subDays(new Date(), days - 2 - i));
    const interval = { start: day, end: i === days - 1 ? new Date() : next };
    const dayStr = format(day, "yyyy-MM-dd");

    const dayLogs = logs.filter((t) => t.log_date === dayStr);
    const hoursLogged = dayLogs.reduce((s, t) => s + Number(t.hours), 0);
    const completions = packages.filter(
      (p) => p.status === "done" && p.completed_date === dayStr
    ).length;

    const flowScore = computeFlowScoreForPeriod(slice, userId, day, interval.end);
    const dayEvents = userActivity(store, userId).filter((e) =>
      isWithinInterval(parseISO(e.created_at), interval)
    );
    const { totalPoints } = computeActionBreakdown(dayEvents, logs);
    const dayReviews = store.qaReviews.filter(
      (r) =>
        r.analyst_id === userId &&
        isWithinInterval(parseISO(r.reviewed_at), interval)
    );
    const productivityScore = computeProductivityScore(completions, hoursLogged, 2);
    const qualityScore = computeQualityScore(
      computeQaPassRate(dayReviews),
      Math.min(
        packages.filter((p) => p.correction_count > 0).reduce((s, p) => s + p.correction_count, 0),
        3
      )
    );

    return {
      date: dayStr,
      label: format(day, "MMM d"),
      flowScore,
      productivityScore,
      qualityScore,
      activityPoints: totalPoints,
      completions,
      hoursLogged,
    };
  });
}

export function deriveAccountabilityFlags(
  user: User,
  packages: WorkPackage[],
  events: ActivityEvent[],
  openCorrections: number
): AccountabilityFlag[] {
  const flags: AccountabilityFlag[] = [];
  const overdue = packages.filter(isOverdue).length;
  const stuck = packages.filter(isStuck).length;
  const corrections = packages.reduce((s, p) => s + p.correction_count, 0);

  if (stuck > 0) {
    flags.push({
      severity: "critical",
      code: "stuck_work",
      message: `${stuck} package(s) marked stuck`,
      metric: stuck,
    });
  }
  if (overdue >= 2) {
    flags.push({
      severity: "critical",
      code: "overdue_multiple",
      message: `${overdue} overdue assignments`,
      metric: overdue,
    });
  } else if (overdue === 1) {
    flags.push({
      severity: "warning",
      code: "overdue_single",
      message: "1 overdue assignment",
      metric: 1,
    });
  }
  if (openCorrections > 0) {
    flags.push({
      severity: "warning",
      code: "open_corrections",
      message: `${openCorrections} open QA correction(s)`,
      metric: openCorrections,
    });
  }
  if (corrections >= 3) {
    flags.push({
      severity: "warning",
      code: "high_correction_count",
      message: `${corrections} total QA corrections on record`,
      metric: corrections,
    });
  }

  const lastEvent = events[0];
  if (lastEvent) {
    const daysIdle = differenceInDays(new Date(), parseISO(lastEvent.created_at));
    if (daysIdle >= 3) {
      flags.push({
        severity: daysIdle >= 5 ? "critical" : "warning",
        code: "low_activity",
        message: `No recorded activity for ${daysIdle} days`,
        metric: daysIdle,
      });
    }
  } else {
    flags.push({
      severity: "info",
      code: "no_activity",
      message: "No activity events logged yet",
    });
  }

  const inQa = packages.filter((p) =>
    ["ready_for_qa", "in_qa"].includes(p.status)
  ).length;
  if (inQa >= 3) {
    flags.push({
      severity: "info",
      code: "qa_backlog",
      message: `${inQa} items waiting on QA`,
      metric: inQa,
    });
  }

  return flags;
}

export function deriveCoachingInsights(
  scorecard: Pick<
    EmployeeScorecard,
    | "flowScore"
    | "productivityScore"
    | "qualityScore"
    | "onTimeScore"
    | "activityScore"
    | "qaPassRate"
    | "corrections"
    | "overdueItems"
    | "stuckItems"
    | "velocityPerWeek"
    | "actionPoints"
    | "submissionsToQa"
    | "avgHoursPerPackage"
    | "metrics"
    | "recentQaFeedback"
  >
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];
  // A 100% pass rate with zero reviews is absence of data, not excellence —
  // never praise or criticize QA quality without at least one real review.
  const hasQaData =
    scorecard.recentQaFeedback.length > 0 || scorecard.submissionsToQa > 0;

  if (hasQaData && scorecard.qaPassRate >= 90 && scorecard.productivityScore < 65) {
    insights.push({
      priority: "high",
      category: "productivity",
      type: "opportunity",
      title: "Excellent QA quality but slow completion speed",
      recommendation:
        "Quality is strong — focus on batching similar packages and reducing wait time between QA cycles.",
      metric: `QA ${scorecard.qaPassRate}% · Productivity ${scorecard.productivityScore}`,
    });
  }
  if (scorecard.productivityScore >= 75 && scorecard.metrics.correctionsReceived >= 3) {
    insights.push({
      priority: "high",
      category: "quality",
      type: "weakness",
      title: "High productivity but elevated correction rate",
      recommendation:
        "Slow down on final review before QA submit. Checklist pass on data accuracy fields.",
      metric: `${scorecard.metrics.correctionsReceived} corrections`,
    });
  }
  if (scorecard.onTimeScore < 70 || scorecard.overdueItems >= 2) {
    insights.push({
      priority: "high",
      category: "timeliness",
      type: "weakness",
      title: "Consistently misses due dates",
      recommendation:
        "Start each day with overdue packages. Escalate blockers before due date passes.",
      metric: `${scorecard.overdueItems} overdue · On-time ${scorecard.onTimeScore}%`,
    });
  }
  if (scorecard.qualityScore < 70 || (hasQaData && scorecard.qaPassRate < 80)) {
    insights.push({
      priority: "high",
      category: "quality",
      type: "weakness",
      title: "Improve first-pass quality",
      recommendation:
        "Review QA feedback before resubmitting. Pair with QA on recurring error categories.",
      metric: hasQaData
        ? `QA pass ${scorecard.qaPassRate}%`
        : `${scorecard.metrics.correctionsReceived} corrections on record`,
    });
  }
  if (scorecard.productivityScore < 60) {
    insights.push({
      priority: "high",
      category: "productivity",
      type: "weakness",
      title: "Increase daily throughput",
      recommendation:
        "Use Start Next Task to reduce context switching. Target 2+ completions per day.",
      metric: `Productivity ${scorecard.productivityScore}`,
    });
  }
  if (scorecard.activityScore < 50) {
    insights.push({
      priority: "medium",
      category: "engagement",
      type: "opportunity",
      title: "Boost system engagement",
      recommendation:
        "Log time, add comments, and update status in Flow so performance is visible to managers.",
      metric: `${scorecard.actionPoints} action pts (7d)`,
    });
  }
  if (scorecard.stuckItems > 0) {
    insights.push({
      priority: "high",
      category: "workflow",
      type: "weakness",
      title: "Unblock stuck packages",
      recommendation: "Escalate blockers to manager with a comment on the stuck package.",
      metric: `${scorecard.stuckItems} stuck`,
    });
  }
  if (hasQaData && scorecard.qaPassRate >= 95 && scorecard.qualityScore >= 85) {
    insights.push({
      priority: "low",
      category: "quality",
      type: "strength",
      title: "Excellent QA quality",
      recommendation: "Maintain standards; consider peer review mentor role.",
      metric: `QA ${scorecard.qaPassRate}%`,
    });
  }
  if (!hasQaData && scorecard.metrics.packagesCompleted > 0) {
    insights.push({
      priority: "medium",
      category: "quality",
      type: "opportunity",
      title: "No QA reviews on record",
      recommendation:
        "Work has been completed without passing through QA — route finished tasks through QA submit so quality is measured, not assumed.",
      metric: `${scorecard.metrics.packagesCompleted} completed · 0 QA reviews`,
    });
  }
  if (insights.length === 0) {
    insights.push({
      priority: "low",
      category: "productivity",
      type: "strength",
      title: "Strong balanced performance",
      recommendation: "Maintain current pace. Consider mentoring peers with lower Flow Scores.",
      metric: `Flow Score ${scorecard.flowScore}`,
    });
  }

  return insights.slice(0, 5);
}

export function engagementLevel(actionPoints: number): "high" | "medium" | "low" {
  if (actionPoints >= 80) return "high";
  if (actionPoints >= 40) return "medium";
  return "low";
}

export function buildEmployeeScorecard(
  user: User,
  store: PerformanceStoreSlice,
  rank = 0,
  totalRanked = 0
): EmployeeScorecard {
  const mine = userPackages(store, user.id);
  const events = userActivity(store, user.id).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const logs = store.timeLogs.filter((t) => t.user_id === user.id);
  const myReviews = store.qaReviews.filter((r) => r.analyst_id === user.id);
  const weekStart = subDays(startOfDay(new Date()), 7);
  const todayStart = startOfDay(new Date());

  const { breakdown, totalPoints } = computeActionBreakdown(events, logs, weekStart);
  const { totalPoints: actionPointsToday } = computeActionBreakdown(
    events,
    logs,
    todayStart
  );

  const hoursLogged = logs.reduce((s, t) => s + Number(t.hours), 0);
  const todayHours = logs
    .filter((t) => t.log_date === appTodayDate())
    .reduce((s, t) => s + Number(t.hours), 0);

  const slice = toAccountabilitySlice(store);
  const teamAvg = teamAvgWeekCompletions(store);
  const scoreBreakdown = computeFlowScoreBreakdown(slice, user.id, teamAvg);
  const productivityScore = scoreBreakdown.productivity.score;
  const qualityScore = scoreBreakdown.quality.score;
  const onTimeScore = scoreBreakdown.onTime.score;
  const activityScore = scoreBreakdown.activity.score;
  const flowScore = scoreBreakdown.flowScore;
  const qaPassRate = computeQaPassRate(myReviews);
  const corrections = mine.reduce((s, p) => s + p.correction_count, 0);
  const onTimeRate = computeOnTimeRate(mine);

  const openCorrections = store.corrections.filter(
    (c) => c.assigned_to === user.id && !c.resolved
  ).length;

  const trend = buildDailyTrends(user.id, store, 14);
  const trend30 = buildDailyTrends(user.id, store, 30);
  const trend90 = buildDailyTrends(user.id, store, 90);
  const managerName = resolveManagerName(user, slice);
  const submissionsToQa = events.filter((e) => e.type === "submit_qa").length;
  const tasksCompleted = events.filter((e) => e.type === "task_complete").length;
  const velocityPerWeek = completedThisWeek(mine);

  const dataSlice = {
    workPackages: store.workPackages,
    timeLogs: store.timeLogs,
    qaReviews: store.qaReviews,
    corrections: store.corrections,
  };
  const metrics = buildScorecardMetrics(user.id, dataSlice);
  const monthlyTrends = buildMonthlyTrends(user.id, dataSlice);
  const quarterlyTrends = buildQuarterlyTrends(user.id, dataSlice);

  const base: EmployeeScorecard = {
    user,
    managerName,
    scoreBreakdown,
    trend30,
    trend90,
    badges: [],
    achievements: [],
    metrics,
    monthlyTrends,
    quarterlyTrends,
    currentWork: mine.filter((p) => p.status !== "done"),
    completedToday: completedToday(mine),
    completedThisWeek: completedThisWeek(mine),
    completedThisMonth: completedThisMonth(mine),
    hoursLogged,
    avgHoursPerPackage: computeAvgCompletionHours(mine),
    qaPassRate,
    corrections,
    onTimeRate,
    overdueItems: mine.filter(isOverdue).length,
    stuckItems: mine.filter(isStuck).length,
    flowScore,
    productivityScore,
    qualityScore,
    onTimeScore,
    activityScore,
    recentActivity: events.slice(0, 12),
    recentQaFeedback: myReviews.slice(0, 5),
    rank,
    totalRanked,
    actionPoints: totalPoints,
    actionPointsToday,
    actionBreakdown: breakdown,
    trend,
    accountabilityFlags: deriveAccountabilityFlags(user, mine, events, openCorrections),
    coachingInsights: [] as CoachingInsight[],
    velocityPerWeek,
    engagementLevel: engagementLevel(totalPoints),
    submissionsToQa,
    tasksCompleted,
  };

  base.coachingInsights = deriveCoachingInsights(base);
  base.badges = computeBadges(base);
  base.achievements = computeAchievements(base);
  return base;
}

export function rankScorecards(scorecards: EmployeeScorecard[]): EmployeeScorecard[] {
  const sorted = [...scorecards].sort((a, b) => b.flowScore - a.flowScore);
  return sorted.map((s, i) => ({
    ...s,
    rank: i + 1,
    totalRanked: sorted.length,
  }));
}

export function toRanking(s: EmployeeScorecard): EmployeeRanking {
  const trendDelta =
    s.trend.length >= 2
      ? s.trend[s.trend.length - 1].flowScore - s.trend[0].flowScore
      : 0;
  return {
    rank: s.rank,
    userId: s.user.id,
    name: s.user.full_name,
    flowScore: s.flowScore,
    actionPoints: s.actionPoints,
    completedThisWeek: s.completedThisWeek,
    qaPassRate: s.qaPassRate,
    trendDelta,
  };
}

export function buildAccountabilityReport(
  scorecards: EmployeeScorecard[]
): AccountabilityReport {
  const entries: AccountabilityEntry[] = scorecards
    .map((s) => {
      const last = s.recentActivity[0];
      const daysSinceLastActivity = last
        ? differenceInDays(new Date(), parseISO(last.created_at))
        : null;
      const openCorrections = s.accountabilityFlags.find(
        (f) => f.code === "open_corrections"
      )?.metric as number | undefined;
      return {
        userId: s.user.id,
        name: s.user.full_name,
        flags: s.accountabilityFlags,
        flowScore: s.flowScore,
        overdueItems: s.overdueItems,
        stuckItems: s.stuckItems,
        openCorrections: openCorrections ?? 0,
        daysSinceLastActivity,
      };
    })
    .filter((e) => e.flags.length > 0)
    .sort((a, b) => {
      const sev = (e: AccountabilityEntry) =>
        e.flags.some((f) => f.severity === "critical")
          ? 3
          : e.flags.some((f) => f.severity === "warning")
            ? 2
            : 1;
      return sev(b) - sev(a);
    });

  return {
    generatedAt: new Date().toISOString(),
    criticalCount: entries.filter((e) =>
      e.flags.some((f) => f.severity === "critical")
    ).length,
    warningCount: entries.filter((e) =>
      e.flags.some((f) => f.severity === "warning")
    ).length,
    entries,
  };
}

export function buildCoachingReport(scorecards: EmployeeScorecard[]): CoachingReport {
  const ranked = rankScorecards(scorecards);
  const teamAverageScore =
    ranked.length > 0
      ? Math.round(ranked.reduce((s, r) => s + r.flowScore, 0) / ranked.length)
      : 0;

  const entries: CoachingReportEntry[] = ranked.map((s) => {
    const strengths = s.coachingInsights
      .filter((i) => i.type === "strength")
      .map((i) => i.title);
    if (s.qualityScore >= 85) strengths.push("Consistent QA pass rate");
    if (s.productivityScore >= 75) strengths.push("Strong daily productivity");
    if (s.onTimeScore >= 85) strengths.push("Reliable on-time delivery");
    if (s.engagementLevel === "high") strengths.push("High system engagement");

    const weaknesses = s.coachingInsights
      .filter((i) => i.type === "weakness")
      .map((i) => i.title);
    const opportunities = s.coachingInsights
      .filter((i) => i.type === "opportunity")
      .map((i) => i.title);

    const focusAreas = s.coachingInsights
      .filter((i) => i.priority !== "low")
      .map((i) => i.title);

    return {
      userId: s.user.id,
      name: s.user.full_name,
      flowScore: s.flowScore,
      rank: s.rank,
      insights: s.coachingInsights,
      strengths: strengths.length ? strengths : ["Building baseline metrics"],
      weaknesses: weaknesses.length ? weaknesses : ["No critical weaknesses flagged"],
      opportunities: opportunities.length ? opportunities : ["Maintain current trajectory"],
      focusAreas: focusAreas.length ? focusAreas : ["Continue current habits"],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    teamAverageScore,
    entries,
  };
}

export function buildTeamTrend(
  store: PerformanceStoreSlice,
  days = 14
): FlowScoreTrendPoint[] {
  const employees = employeeUsers(store.users);
  if (employees.length === 0) return buildDailyTrends("user-michael", store, days);

  return Array.from({ length: days }, (_, i) => {
    const day = startOfDay(subDays(new Date(), days - 1 - i));
    const dayStr = format(day, "yyyy-MM-dd");
    const points = employees.map((u) => {
      const t = buildDailyTrends(u.id, store, days);
      return t.find((p) => p.date === dayStr)!;
    });
    const n = points.length;
    return {
      date: dayStr,
      label: format(day, "MMM d"),
      flowScore: Math.round(points.reduce((s, p) => s + p.flowScore, 0) / n),
      productivityScore: Math.round(
        points.reduce((s, p) => s + p.productivityScore, 0) / n
      ),
      qualityScore: Math.round(points.reduce((s, p) => s + p.qualityScore, 0) / n),
      activityPoints: points.reduce((s, p) => s + p.activityPoints, 0),
      completions: points.reduce((s, p) => s + p.completions, 0),
      hoursLogged: Math.round(points.reduce((s, p) => s + p.hoursLogged, 0) * 10) / 10,
    };
  });
}

export function buildAccountabilityDashboard(
  scorecards: EmployeeScorecard[]
): AccountabilityDashboard {
  const rankings = scorecards.map(toRanking);
  const n = scorecards.length || 1;

  const mostImproved = [...rankings].sort((a, b) => b.trendDelta - a.trendDelta).slice(0, 5);
  const mostConsistent = [...scorecards]
    .sort((a, b) => {
      const varA = variance(a.trend30.map((t) => t.flowScore));
      const varB = variance(b.trend30.map((t) => t.flowScore));
      return varA - varB;
    })
    .slice(0, 5)
    .map((s) => toRanking(s));

  const highestCorrectionRate = [...scorecards]
    .map((s) => ({
      userId: s.user.id,
      name: s.user.full_name,
      count: s.metrics.correctionsReceived,
      rate:
        s.submissionsToQa > 0
          ? Math.round((s.metrics.correctionsReceived / s.submissionsToQa) * 100)
          : s.metrics.correctionsReceived * 10,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const mostOverdue = [...scorecards]
    .map((s) => ({
      userId: s.user.id,
      name: s.user.full_name,
      count: s.metrics.overdueWork,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    departmentAvgFlowScore: Math.round(
      scorecards.reduce((s, c) => s + c.flowScore, 0) / n
    ),
    teamProductivity: Math.round(
      scorecards.reduce((s, c) => s + c.productivityScore, 0) / n
    ),
    teamQaRate: Math.round(scorecards.reduce((s, c) => s + c.qaPassRate, 0) / n),
    topPerformers: rankings.slice(0, 5),
    mostImproved,
    mostConsistent,
    needsAttention: scorecards
      .filter(
        (s) =>
          s.stuckItems > 0 ||
          s.overdueItems > 0 ||
          s.accountabilityFlags.some((f) => f.severity === "critical")
      )
      .map((s) => ({
        userId: s.user.id,
        name: s.user.full_name,
        flowScore: s.flowScore,
        reason:
          s.accountabilityFlags.find((f) => f.severity === "critical")?.message ??
          `${s.overdueItems} overdue`,
      }))
      .slice(0, 8),
    highestCorrectionRate,
    mostOverdue,
    workloadDistribution: scorecards.map((s) => ({
      userId: s.user.id,
      name: s.user.full_name,
      active: s.metrics.activeWork,
      hours: s.metrics.hoursLogged,
      flowScore: s.flowScore,
    })),
    rankings,
    trends30: scorecards.length > 0 ? buildTeamTrendFromScorecards(scorecards, 30) : [],
  };
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function buildTeamTrendFromScorecards(
  scorecards: EmployeeScorecard[],
  days: number
): FlowScoreTrendPoint[] {
  const ref = scorecards[0]?.trend30 ?? [];
  const slice = days === 30 ? ref : scorecards[0]?.trend90 ?? ref;
  if (slice.length === 0) return [];
  return slice.map((point, i) => {
    const scores = scorecards.map((s) => {
      const t = days === 30 ? s.trend30 : s.trend90;
      return t[i]?.flowScore ?? s.flowScore;
    });
    return {
      ...point,
      flowScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    };
  });
}

export function buildTeamPerformanceDashboard(
  store: PerformanceStoreSlice
): TeamPerformanceDashboard {
  const employees = employeeUsers(store.users);
  let scorecards = employees.map((u) => buildEmployeeScorecard(u, store));
  scorecards = rankScorecards(scorecards);
  const rankings = scorecards.map(toRanking);

  const accountability = buildAccountabilityReport(scorecards);
  const coaching = buildCoachingReport(scorecards);

  const needsAttention = scorecards
    .filter(
      (s) =>
        s.stuckItems > 0 ||
        s.overdueItems > 0 ||
        s.accountabilityFlags.some((f) => f.severity === "critical")
    )
    .map((s) => ({
      userId: s.user.id,
      name: s.user.full_name,
      flowScore: s.flowScore,
      reason:
        s.accountabilityFlags.find((f) => f.severity === "critical")?.message ??
        (s.stuckItems > 0
          ? `${s.stuckItems} stuck`
          : `${s.overdueItems} overdue`),
    }))
    .slice(0, 8);

  const accountabilityDashboard = buildAccountabilityDashboard(scorecards);

  return {
    teamFlowScore: accountabilityDashboard.departmentAvgFlowScore,
    teamActionPoints: scorecards.reduce((s, c) => s + c.actionPoints, 0),
    avgQaPassRate: accountabilityDashboard.teamQaRate,
    avgOnTimeRate:
      scorecards.length > 0
        ? Math.round(scorecards.reduce((s, c) => s + c.onTimeRate, 0) / scorecards.length)
        : 0,
    rankings,
    trends: buildTeamTrend(store),
    accountability,
    accountabilityDashboard,
    coaching,
    topPerformers: rankings.slice(0, 5),
    needsAttention,
    leaderboard: rankings,
  };
}
