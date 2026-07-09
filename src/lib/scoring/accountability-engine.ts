import { activityScoreFromPoints, getActionPoints } from "@/lib/scoring/action-weights";
import {
  completedInRange,
  completedThisMonth,
  completedThisWeek,
  completedToday,
  computeQaPassRate,
  isOverdue,
} from "@/lib/scoring/flow-score";
import type {
  ActivityEvent,
  Comment,
  ComponentScore,
  Correction,
  FlowFile,
  FlowScoreBreakdown,
  QaReview,
  ScoreFactor,
  Team,
  TimeLog,
  User,
  WorkPackage,
} from "@/types/flow";
import {
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export interface AccountabilityDataSlice {
  users: User[];
  teams: Team[];
  workPackages: WorkPackage[];
  timeLogs: TimeLog[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  corrections: Correction[];
  comments?: Comment[];
  files?: FlowFile[];
}

const FLOW_WEIGHTS = {
  productivity: 0.4,
  quality: 0.3,
  onTime: 0.2,
  activity: 0.1,
} as const;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function factor(
  id: string,
  label: string,
  rawValue: number | string,
  normalizedScore: number,
  weight: number,
  explanation: string
): ScoreFactor {
  const n = clamp(normalizedScore);
  return {
    id,
    label,
    rawValue,
    normalizedScore: n,
    weight,
    contribution: Math.round(n * weight * 10) / 10,
    explanation,
  };
}

function componentScore(
  score: number,
  weight: number,
  factors: ScoreFactor[]
): ComponentScore {
  return {
    score: clamp(score),
    weight,
    factors,
  };
}

function userPackages(slice: AccountabilityDataSlice, userId: string) {
  return slice.workPackages.filter((p) => p.assigned_to === userId);
}

function userEvents(slice: AccountabilityDataSlice, userId: string) {
  return slice.activity.filter((a) => a.user_id === userId);
}

function userReviews(slice: AccountabilityDataSlice, userId: string) {
  return slice.qaReviews.filter((r) => r.analyst_id === userId);
}

function userCorrections(slice: AccountabilityDataSlice, userId: string) {
  return slice.corrections.filter((c) => c.assigned_to === userId);
}

export function resolveManagerName(
  user: User,
  slice: AccountabilityDataSlice
): string | null {
  if (user.manager_id) {
    const direct = slice.users.find((u) => u.id === user.manager_id);
    if (direct) return direct.full_name;
  }
  if (!user.team_id) return null;
  const team = slice.teams.find((t) => t.id === user.team_id);
  if (!team?.manager_id) return null;
  const manager = slice.users.find((u) => u.id === team.manager_id);
  return manager?.full_name ?? null;
}

export function computeProductivityBreakdown(
  slice: AccountabilityDataSlice,
  userId: string,
  teamAvgWeekCompletions = 3
): ComponentScore {
  const mine = userPackages(slice, userId);
  const logs = slice.timeLogs.filter((t) => t.user_id === userId);
  const weekStart = subDays(startOfDay(new Date()), 7);
  const weekEnd = new Date();

  const completedAll = mine.filter((p) => p.status === "done").length;
  const completedWeek = completedThisWeek(mine);
  const completedMonth = completedThisMonth(mine);
  const hoursWeek = logs
    .filter((t) => isWithinInterval(parseISO(t.log_date), { start: weekStart, end: weekEnd }))
    .reduce((s, t) => s + Number(t.hours), 0);

  const doneWithEst = mine.filter(
    (p) => p.status === "done" && p.estimated_hours > 0 && p.actual_hours > 0
  );
  let estimateScore = 75;
  if (doneWithEst.length > 0) {
    const ratios = doneWithEst.map((p) => Number(p.actual_hours) / Number(p.estimated_hours));
    const avgRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    estimateScore = avgRatio <= 1 ? 100 : avgRatio <= 1.15 ? 85 : avgRatio <= 1.35 ? 65 : 40;
  }

  const active = mine.filter((p) => p.status !== "done").length;
  const assigned = mine.length;
  const workloadScore =
    assigned === 0 ? 50 : clamp(((completedAll + active * 0.4) / Math.max(assigned, 6)) * 100);

  const velocityScore = clamp((completedWeek / Math.max(teamAvgWeekCompletions, 1)) * 100);

  const factors = [
    factor(
      "packages_completed",
      "Work packages completed",
      completedAll,
      clamp((completedMonth / 8) * 100),
      0.25,
      `${completedAll} total done (${completedMonth} this month, ${completedWeek} this week) from work_packages where status = done`
    ),
    factor(
      "hours_logged",
      "Hours logged",
      Math.round(hoursWeek * 10) / 10,
      clamp((hoursWeek / 35) * 100),
      0.2,
      `${hoursWeek}h logged in the last 7 days from time_logs`
    ),
    factor(
      "estimate_accuracy",
      "Estimated vs actual hours",
      doneWithEst.length > 0
        ? `${Math.round(
            (doneWithEst.reduce((s, p) => s + Number(p.actual_hours) / Number(p.estimated_hours), 0) /
              doneWithEst.length) *
              100
          )}% avg ratio`
        : "N/A",
      estimateScore,
      0.2,
      "Compares actual_hours to estimated_hours on completed work_packages"
    ),
    factor(
      "workload_handled",
      "Workload handled",
      `${active} active / ${assigned} assigned`,
      workloadScore,
      0.2,
      "Balance of completed and in-flight assigned packages"
    ),
    factor(
      "velocity",
      "Completion velocity",
      completedWeek,
      velocityScore,
      0.15,
      `Completions this week vs team average (${teamAvgWeekCompletions}/week)`
    ),
  ];

  const weighted = factors.reduce((s, f) => s + f.normalizedScore * f.weight, 0);
  return componentScore(weighted, FLOW_WEIGHTS.productivity, factors);
}

export function computeQualityBreakdown(
  slice: AccountabilityDataSlice,
  userId: string
): ComponentScore {
  const reviews = userReviews(slice, userId);
  const corrections = userCorrections(slice, userId);
  const mine = userPackages(slice, userId);

  const qaPassRate = computeQaPassRate(reviews);
  const majorCount = reviews.filter((r) => r.result === "major_correction").length;
  const rejectedCount = reviews.filter((r) => r.result === "rejected").length;
  const correctionTotal = corrections.length + mine.reduce((s, p) => s + p.correction_count, 0);
  const submissions = slice.activity.filter(
    (e) => e.user_id === userId && e.type === "submit_qa"
  ).length;
  const reworkPct =
    submissions > 0 ? Math.round((correctionTotal / submissions) * 100) : 0;

  // No QA history is not the same as a perfect record. Work that has never
  // faced review scores neutral, so avoiding submission can't buy points.
  const qaPassScore = reviews.length === 0 ? 60 : qaPassRate;

  const factors = [
    factor(
      "qa_pass_rate",
      "QA pass rate",
      reviews.length === 0 ? "no reviews yet" : `${qaPassRate}%`,
      qaPassScore,
      0.35,
      reviews.length === 0
        ? "No QA reviews on record — neutral score until work faces review"
        : `${reviews.filter((r) => r.result === "pass").length} passed of ${reviews.length} qa_reviews`
    ),
    factor(
      "corrections_received",
      "Corrections received",
      correctionTotal,
      clamp(100 - correctionTotal * 6),
      0.25,
      "Count from corrections table + correction_count on assigned work_packages"
    ),
    factor(
      "major_corrections",
      "Major corrections",
      majorCount,
      clamp(100 - majorCount * 15),
      0.2,
      'qa_reviews with result = "major_correction"'
    ),
    factor(
      "rejected_work",
      "Rejected work",
      rejectedCount,
      clamp(100 - rejectedCount * 20),
      0.15,
      'qa_reviews with result = "rejected"'
    ),
    factor(
      "rework_percentage",
      "Rework percentage",
      `${reworkPct}%`,
      clamp(100 - reworkPct),
      0.05,
      "Corrections relative to QA submissions from activity_events"
    ),
  ];

  const weighted = factors.reduce((s, f) => s + f.normalizedScore * f.weight, 0);
  return componentScore(weighted, FLOW_WEIGHTS.quality, factors);
}

export function computeOnTimeBreakdown(
  slice: AccountabilityDataSlice,
  userId: string
): ComponentScore {
  const mine = userPackages(slice, userId);
  const withDue = mine.filter((p) => p.due_date);
  const done = withDue.filter((p) => p.status === "done" && p.completed_date);
  const onTime = done.filter(
    (p) => !isAfter(parseISO(p.completed_date!), parseISO(p.due_date!))
  );
  const late = done.length - onTime.length;
  // Zero completions is not a perfect on-time record — never finishing
  // anything scores neutral, not 100.
  const onTimePct = done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 60;

  const overdue = mine.filter(isOverdue).length;

  let totalDelayDays = 0;
  let delayCount = 0;
  for (const p of done) {
    if (isAfter(parseISO(p.completed_date!), parseISO(p.due_date!))) {
      totalDelayDays += differenceInCalendarDays(
        parseISO(p.completed_date!),
        parseISO(p.due_date!)
      );
      delayCount++;
    }
  }
  const avgDelay = delayCount > 0 ? Math.round((totalDelayDays / delayCount) * 10) / 10 : 0;
  const delayScore = avgDelay === 0 ? 100 : avgDelay <= 1 ? 85 : avgDelay <= 3 ? 65 : 40;

  const factors = [
    factor(
      "on_time_completions",
      "Completed before due date",
      `${onTime.length}/${done.length}`,
      onTimePct,
      0.4,
      "Completed work_packages where completed_date <= due_date"
    ),
    factor(
      "late_completions",
      "Completed late",
      late,
      clamp(100 - late * 12),
      0.25,
      "Done packages where completed_date is after due_date"
    ),
    factor(
      "overdue_items",
      "Current overdue items",
      overdue,
      clamp(100 - overdue * 18),
      0.25,
      "Active assigned packages past due_date"
    ),
    factor(
      "avg_delay_days",
      "Average delay (days)",
      avgDelay,
      delayScore,
      0.1,
      "Mean calendar days late for packages completed after due date"
    ),
  ];

  const weighted = factors.reduce((s, f) => s + f.normalizedScore * f.weight, 0);
  return componentScore(weighted, FLOW_WEIGHTS.onTime, factors);
}

export function computeActivityBreakdown(
  slice: AccountabilityDataSlice,
  userId: string
): ComponentScore {
  const events = userEvents(slice, userId);
  const logs = slice.timeLogs.filter((t) => t.user_id === userId);
  const weekStart = subDays(startOfDay(new Date()), 14);
  const recentEvents = events.filter((e) => parseISO(e.created_at) >= weekStart);

  const logDays = new Set(
    logs
      .filter((t) => parseISO(t.log_date) >= weekStart)
      .map((t) => t.log_date)
  ).size;
  const timeConsistency = clamp((logDays / 10) * 100);

  const comments = recentEvents.filter((e) => e.type === "comment").length;
  const statusUpdates = recentEvents.filter((e) => e.type === "status_change").length;
  const fileUploads = recentEvents.filter((e) => e.type === "file_upload").length;

  const activeDays = new Set(
    recentEvents.map((e) => format(parseISO(e.created_at), "yyyy-MM-dd"))
  ).size;
  const dailyEngagement = clamp((activeDays / 10) * 100);

  const weekStart7 = subDays(startOfDay(new Date()), 7);
  const weekEvents = events.filter((e) => parseISO(e.created_at) >= weekStart7);
  let totalPoints = 0;
  for (const e of weekEvents) {
    totalPoints += getActionPoints(e);
  }
  const engagementPts = activityScoreFromPoints(totalPoints);

  const factors = [
    factor(
      "time_logging",
      "Time logging consistency",
      `${logDays}/10 days`,
      timeConsistency,
      0.25,
      "Distinct days with time_logs entries in the last 14 days"
    ),
    factor(
      "comments",
      "Comments added",
      comments,
      clamp((comments / 8) * 100),
      0.2,
      'activity_events with type = "comment" (last 14 days)'
    ),
    factor(
      "status_updates",
      "Status updates",
      statusUpdates,
      clamp((statusUpdates / 12) * 100),
      0.2,
      'activity_events with type = "status_change"'
    ),
    factor(
      "file_uploads",
      "File upload activity",
      fileUploads,
      clamp((fileUploads / 5) * 100),
      0.15,
      'activity_events with type = "file_upload"'
    ),
    factor(
      "daily_engagement",
      "Daily engagement",
      `${activeDays} active days`,
      dailyEngagement,
      0.2,
      "Unique days with any activity_events in the last 14 days"
    ),
  ];

  const weighted = factors.reduce((s, f) => s + f.normalizedScore * f.weight, 0);
  const blended = Math.round(weighted * 0.7 + engagementPts * 0.3);
  return componentScore(blended, FLOW_WEIGHTS.activity, factors);
}

export function computeFlowScoreBreakdown(
  slice: AccountabilityDataSlice,
  userId: string,
  teamAvgWeekCompletions = 3
): FlowScoreBreakdown {
  const productivity = computeProductivityBreakdown(slice, userId, teamAvgWeekCompletions);
  const quality = computeQualityBreakdown(slice, userId);
  const onTime = computeOnTimeBreakdown(slice, userId);
  const activity = computeActivityBreakdown(slice, userId);

  const flowScore = clamp(
    productivity.score * FLOW_WEIGHTS.productivity +
      quality.score * FLOW_WEIGHTS.quality +
      onTime.score * FLOW_WEIGHTS.onTime +
      activity.score * FLOW_WEIGHTS.activity
  );

  return {
    flowScore,
    formula: "40% Productivity + 30% Quality + 20% On-Time + 10% Activity",
    productivity,
    quality,
    onTime,
    activity,
    calculatedAt: new Date().toISOString(),
  };
}

/** Daily flow score for trend charts using the same formula on period data */
export function computeFlowScoreForPeriod(
  slice: AccountabilityDataSlice,
  userId: string,
  start: Date,
  end: Date
): number {
  const periodSlice: AccountabilityDataSlice = {
    ...slice,
    workPackages: slice.workPackages.map((p) => ({ ...p })),
    timeLogs: slice.timeLogs.filter((t) => {
      const d = parseISO(t.log_date);
      return isWithinInterval(d, { start, end });
    }),
    qaReviews: slice.qaReviews.filter((r) =>
      isWithinInterval(parseISO(r.reviewed_at), { start, end })
    ),
    activity: slice.activity.filter((e) =>
      isWithinInterval(parseISO(e.created_at), { start, end })
    ),
    corrections: slice.corrections.filter((c) =>
      isWithinInterval(parseISO(c.created_at), { start, end })
    ),
  };

  const pkgs = userPackages(slice, userId);
  const completions = completedInRange(pkgs, start, end);
  const hours = periodSlice.timeLogs.reduce((s, t) => s + Number(t.hours), 0);

  const reviews = userReviews(periodSlice, userId);
  const qaPass = computeQaPassRate(reviews);
  const corr = userCorrections(periodSlice, userId).length;

  const prod = clamp((completions / 2) * 50 + (hours / 8) * 50);
  const qual = clamp(computeQualityScoreSimple(qaPass, corr));
  const onT = clamp(computeOnTimeRateSimple(pkgs, end));
  let totalPoints = 0;
  for (const e of periodSlice.activity) {
    totalPoints += getActionPoints(e);
  }
  const act = activityScoreFromPoints(totalPoints, 25);

  return clamp(prod * 0.4 + qual * 0.3 + onT * 0.2 + act * 0.1);
}

function computeQualityScoreSimple(qaPassRate: number, corrections: number): number {
  return Math.max(0, qaPassRate - Math.min(corrections * 5, 35));
}

function computeOnTimeRateSimple(packages: WorkPackage[], asOf: Date): number {
  const done = packages.filter(
    (p) => p.status === "done" && p.due_date && p.completed_date
  );
  if (done.length === 0) return 100;
  const onTime = done.filter(
    (p) => !isAfter(parseISO(p.completed_date!), parseISO(p.due_date!))
  ).length;
  const overdue = packages.filter(
    (p) =>
      p.status !== "done" &&
      p.due_date &&
      isBeforeDue(p.due_date, asOf)
  ).length;
  return clamp((onTime / done.length) * 100 - overdue * 10);
}

function isBeforeDue(due: string, asOf: Date): boolean {
  return isBefore(parseISO(due), startOfDay(asOf));
}
