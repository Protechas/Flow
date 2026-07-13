import {
  completedInRange,
  computeAvgCompletionHours,
  computeQaPassRate,
} from "@/lib/scoring/flow-score";
import { isProductionRosterMember } from "@/lib/users/production-roster";
import type {
  Correction,
  QaReview,
  ScorecardMetrics,
  ScorecardPeriodTrendPoint,
  TeamScorecardSummary,
  TimeLog,
  User,
  WorkPackage,
  EmployeeScorecard,
} from "@/types/flow";
import {
  endOfMonth,
  endOfQuarter,
  format,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfQuarter,
  subMonths,
  subQuarters,
} from "date-fns";

export interface ScorecardDataSlice {
  workPackages: WorkPackage[];
  timeLogs: TimeLog[];
  qaReviews: QaReview[];
  corrections: Correction[];
}

function userPackages(packages: WorkPackage[], userId: string) {
  return packages.filter((p) => p.assigned_to === userId);
}

function userCorrections(corrections: Correction[], userId: string) {
  return corrections.filter((c) => c.assigned_to === userId);
}

function hoursInRange(logs: TimeLog[], userId: string, start: Date, end: Date): number {
  return logs
    .filter((t) => {
      if (t.user_id !== userId) return false;
      const d = parseISO(t.log_date);
      return isWithinInterval(d, { start, end });
    })
    .reduce((s, t) => s + Number(t.hours), 0);
}

function packagesCompletedInRange(
  packages: WorkPackage[],
  userId: string,
  start: Date,
  end: Date
): number {
  return completedInRange(userPackages(packages, userId), start, end);
}

function avgCompletionInRange(
  packages: WorkPackage[],
  userId: string,
  start: Date,
  end: Date
): number {
  const done = userPackages(packages, userId).filter((p) => {
    if (p.status !== "done" || !p.completed_date) return false;
    const d = parseISO(p.completed_date);
    return isWithinInterval(d, { start, end });
  });
  return computeAvgCompletionHours(done);
}

function qaPassInRange(
  reviews: QaReview[],
  userId: string,
  start: Date,
  end: Date
): number {
  const inRange = reviews.filter(
    (r) =>
      r.analyst_id === userId &&
      isWithinInterval(parseISO(r.reviewed_at), { start, end })
  );
  return computeQaPassRate(inRange);
}

function correctionsReceivedInRange(
  corrections: Correction[],
  userId: string,
  start: Date,
  end: Date
): number {
  return userCorrections(corrections, userId).filter((c) =>
    isWithinInterval(parseISO(c.created_at), { start, end })
  ).length;
}

function correctionsResolvedInRange(
  corrections: Correction[],
  userId: string,
  start: Date,
  end: Date
): number {
  return userCorrections(corrections, userId).filter(
    (c) =>
      c.resolved &&
      c.resolved_at &&
      isWithinInterval(parseISO(c.resolved_at), { start, end })
  ).length;
}

function activeWorkAtEnd(
  packages: WorkPackage[],
  userId: string,
  end: Date
): number {
  return userPackages(packages, userId).filter((p) => {
    if (p.status === "done") return false;
    if (p.completed_date && !isBefore(parseISO(p.completed_date), end)) return false;
    return true;
  }).length;
}

function overdueWorkAtEnd(
  packages: WorkPackage[],
  userId: string,
  end: Date
): number {
  return userPackages(packages, userId).filter((p) => {
    if (!p.due_date) return false;
    if (p.completed_date && !isBefore(end, parseISO(p.completed_date))) return false;
    return isBefore(parseISO(p.due_date), end);
  }).length;
}

function buildPeriodPoint(
  userId: string,
  slice: ScorecardDataSlice,
  start: Date,
  end: Date,
  period: string,
  label: string
): ScorecardPeriodTrendPoint {
  return {
    period,
    label,
    packagesCompleted: packagesCompletedInRange(
      slice.workPackages,
      userId,
      start,
      end
    ),
    hoursLogged: Math.round(hoursInRange(slice.timeLogs, userId, start, end) * 10) / 10,
    avgCompletionTimeHours: avgCompletionInRange(
      slice.workPackages,
      userId,
      start,
      end
    ),
    qaPassRate: qaPassInRange(slice.qaReviews, userId, start, end),
    correctionsReceived: correctionsReceivedInRange(
      slice.corrections,
      userId,
      start,
      end
    ),
    correctionsResolved: correctionsResolvedInRange(
      slice.corrections,
      userId,
      start,
      end
    ),
    overdueWork: overdueWorkAtEnd(slice.workPackages, userId, end),
    activeWork: activeWorkAtEnd(slice.workPackages, userId, end),
  };
}

export function buildMonthlyTrends(
  userId: string,
  slice: ScorecardDataSlice,
  months = 6
): ScorecardPeriodTrendPoint[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const monthStart = startOfMonth(subMonths(now, months - 1 - i));
    const monthEnd = endOfMonth(monthStart);
    const period = format(monthStart, "yyyy-MM");
    return buildPeriodPoint(
      userId,
      slice,
      monthStart,
      monthEnd,
      period,
      format(monthStart, "MMM yyyy")
    );
  });
}

export function buildQuarterlyTrends(
  userId: string,
  slice: ScorecardDataSlice,
  quarters = 4
): ScorecardPeriodTrendPoint[] {
  const now = new Date();
  return Array.from({ length: quarters }, (_, i) => {
    const qStart = startOfQuarter(subQuarters(now, quarters - 1 - i));
    const qEnd = endOfQuarter(qStart);
    const period = format(qStart, "yyyy-'Q'Q");
    return buildPeriodPoint(
      userId,
      slice,
      qStart,
      qEnd,
      period,
      `Q${format(qStart, "Q")} ${format(qStart, "yyyy")}`
    );
  });
}

export function buildScorecardMetrics(
  userId: string,
  slice: ScorecardDataSlice
): ScorecardMetrics {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);

  const mine = userPackages(slice.workPackages, userId);
  const myCorrections = userCorrections(slice.corrections, userId);
  const logs = slice.timeLogs.filter((t) => t.user_id === userId);
  const reviews = slice.qaReviews.filter((r) => r.analyst_id === userId);

  return {
    packagesCompleted: mine.filter((p) => p.status === "done").length,
    packagesCompletedMonth: packagesCompletedInRange(
      slice.workPackages,
      userId,
      monthStart,
      monthEnd
    ),
    packagesCompletedQuarter: packagesCompletedInRange(
      slice.workPackages,
      userId,
      quarterStart,
      quarterEnd
    ),
    hoursLogged: Math.round(logs.reduce((s, t) => s + Number(t.hours), 0) * 10) / 10,
    hoursLoggedMonth: Math.round(hoursInRange(slice.timeLogs, userId, monthStart, monthEnd) * 10) / 10,
    hoursLoggedQuarter: Math.round(
      hoursInRange(slice.timeLogs, userId, quarterStart, quarterEnd) * 10
    ) / 10,
    avgCompletionTimeHours: computeAvgCompletionHours(
      mine.filter((p) => p.status === "done")
    ),
    qaPassRate: computeQaPassRate(reviews),
    correctionsReceived: myCorrections.length,
    correctionsResolved: myCorrections.filter((c) => c.resolved).length,
    openCorrections: myCorrections.filter((c) => !c.resolved).length,
    overdueWork: mine.filter(
      (p) => p.status !== "done" && p.due_date && isBefore(parseISO(p.due_date), now)
    ).length,
    activeWork: mine.filter((p) => p.status !== "done").length,
  };
}

function emptyMetrics(): ScorecardMetrics {
  return {
    packagesCompleted: 0,
    packagesCompletedMonth: 0,
    packagesCompletedQuarter: 0,
    hoursLogged: 0,
    hoursLoggedMonth: 0,
    hoursLoggedQuarter: 0,
    avgCompletionTimeHours: 0,
    qaPassRate: 100,
    correctionsReceived: 0,
    correctionsResolved: 0,
    openCorrections: 0,
    overdueWork: 0,
    activeWork: 0,
  };
}

export function buildTeamScorecardSummary(
  scorecards: EmployeeScorecard[]
): TeamScorecardSummary {
  if (scorecards.length === 0) {
    const empty = emptyMetrics();
    return {
      employeeCount: 0,
      averages: empty,
      totals: {
        packagesCompleted: 0,
        hoursLogged: 0,
        correctionsReceived: 0,
        correctionsResolved: 0,
        overdueWork: 0,
        activeWork: 0,
      },
    };
  }

  const n = scorecards.length;
  const sum = (fn: (m: ScorecardMetrics) => number) =>
    scorecards.reduce((s, c) => s + fn(c.metrics), 0);

  const averages: ScorecardMetrics = {
    packagesCompleted: Math.round(sum((m) => m.packagesCompleted) / n),
    packagesCompletedMonth: Math.round(sum((m) => m.packagesCompletedMonth) / n),
    packagesCompletedQuarter: Math.round(sum((m) => m.packagesCompletedQuarter) / n),
    hoursLogged: Math.round((sum((m) => m.hoursLogged) / n) * 10) / 10,
    hoursLoggedMonth: Math.round((sum((m) => m.hoursLoggedMonth) / n) * 10) / 10,
    hoursLoggedQuarter: Math.round((sum((m) => m.hoursLoggedQuarter) / n) * 10) / 10,
    avgCompletionTimeHours:
      Math.round((sum((m) => m.avgCompletionTimeHours) / n) * 10) / 10,
    qaPassRate: Math.round(sum((m) => m.qaPassRate) / n),
    correctionsReceived: Math.round(sum((m) => m.correctionsReceived) / n),
    correctionsResolved: Math.round(sum((m) => m.correctionsResolved) / n),
    openCorrections: Math.round(sum((m) => m.openCorrections) / n),
    overdueWork: Math.round(sum((m) => m.overdueWork) / n),
    activeWork: Math.round(sum((m) => m.activeWork) / n),
  };

  return {
    employeeCount: n,
    averages,
    totals: {
      packagesCompleted: sum((m) => m.packagesCompleted),
      hoursLogged: Math.round(sum((m) => m.hoursLogged) * 10) / 10,
      correctionsReceived: sum((m) => m.correctionsReceived),
      correctionsResolved: sum((m) => m.correctionsResolved),
      overdueWork: sum((m) => m.overdueWork),
      activeWork: sum((m) => m.activeWork),
    },
  };
}

export function employeeUsers(users: User[]) {
  // Team-aware: support teams (e.g. Email Team) never rank in production metrics.
  return users.filter(isProductionRosterMember);
}
