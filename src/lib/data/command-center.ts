import { appTodayDate } from "@/lib/datetime/timezone";
import {
  computeQaTurnaroundHours,
  generateCommandCenterInsights,
} from "@/lib/insights/command-center-insights";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import { getProjectHealthList } from "@/lib/data/project-health";
import { buildProjectEarlyWarningMap } from "@/lib/forecast/project-early-warning";
import { getWorkPackages } from "@/lib/data/work-packages";
import {
  computeQaPassRate,
  isOverdue,
  isStuck,
} from "@/lib/scoring/flow-score";
import { hasPermission } from "@/lib/auth/permissions";
import type { CommandCenterMetrics, EmployeeRanking, EmployeeScorecard, User } from "@/types/flow";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import {
  buildWorkloadAlertSummary,
  listWorkloadAlertsForViewer,
} from "@/lib/workload-alerts/engine";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import {
  buildHelpFlagSummary,
  listHelpFlagsForViewer,
} from "@/lib/help-flags/engine";
import { getVisibleUserIds, isHierarchyOrgWide } from "@/lib/hierarchy/resolver";
import { getWrapUpDashboardStats } from "@/lib/wrap-up/review";
import { getWrapUpCompletionPctForUsers } from "@/lib/wrap-up/compliance";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { buildExecutiveOutcomeMetrics } from "@/lib/metrics/project-metrics-aggregate";
import { ensureProjectMetricsHydrated } from "@/lib/data/project-metrics-db";
import { buildForecastDashboardStats } from "@/lib/forecast/metrics";
import {
  getProductionStore,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import {
  healthLevelFromScore,
  type DepartmentHealthSummary,
} from "@/lib/design/department-health";
import { buildScopedWorkVisibility } from "@/lib/work-visibility/engine";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { isSameDay, parseISO, subDays } from "date-fns";

function trendDeltaFor(sc: EmployeeScorecard, rankings: EmployeeRanking[]): number {
  return rankings.find((r) => r.userId === sc.user.id)?.trendDelta ?? 0;
}

function buildAttentionList(
  scorecards: EmployeeScorecard[],
  rankings: EmployeeRanking[]
): CommandCenterMetrics["accountability"]["attentionList"] {
  const items: CommandCenterMetrics["accountability"]["attentionList"] = [];

  for (const sc of scorecards) {
    const trendDelta = trendDeltaFor(sc, rankings);
    if (sc.overdueItems >= 2 || sc.stuckItems > 0) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "coaching",
        reason:
          sc.stuckItems > 0
            ? `${sc.stuckItems} stuck · ${sc.overdueItems} overdue`
            : `${sc.overdueItems} overdue packages`,
        priority: sc.stuckItems > 0 ? 90 : 70 + sc.overdueItems,
        flowScore: sc.flowScore,
      });
    }
    if (trendDelta < -5) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "support",
        reason: `${OPS_COPY.operationsScore} declining (${trendDelta} trend)`,
        priority: 60 + Math.abs(trendDelta),
        flowScore: sc.flowScore,
      });
    }
    if (sc.metrics.correctionsReceived >= 3 && sc.qaPassRate < 80) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "coaching",
        reason: `${sc.metrics.correctionsReceived} QA corrections · ${sc.qaPassRate}% pass rate`,
        priority: 75,
        flowScore: sc.flowScore,
      });
    }
    if (sc.flowScore >= 85 && trendDelta >= 3) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "recognition",
        reason: `Top performer · +${trendDelta} trend · ${sc.flowScore} ${OPS_COPY.operationsScore}`,
        priority: 100 - sc.flowScore,
        flowScore: sc.flowScore,
      });
    }
    if (sc.metrics.activeWork >= 8) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "support",
        reason: `Overloaded with ${sc.metrics.activeWork} active packages`,
        priority: 80,
        flowScore: sc.flowScore,
      });
    }
  }

  const seen = new Set<string>();
  return items
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const key = `${item.userId}-${item.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function buildDepartmentHealth(
  store: ReturnType<typeof getFlowStore>,
  packages: Awaited<ReturnType<typeof getWorkPackages>>,
  scorecards: EmployeeScorecard[]
): DepartmentHealthSummary[] {
  const departments = listDepartments().filter((d) => d.status === "active");

  return departments.map((dept) => {
    const teamIds = store.teams.filter((t) => t.department_id === dept.id).map((t) => t.id);
    const userIds = store.users
      .filter((u) => u.is_active && u.team_id && teamIds.includes(u.team_id))
      .map((u) => u.id);

    const deptPackages = packages.filter(
      (p) =>
        p.department_id === dept.id ||
        (p.assigned_to && userIds.includes(p.assigned_to))
    );
    const activeTasks = deptPackages.filter((p) => p.status !== "done").length;
    const overdueTasks = deptPackages.filter(isOverdue).length;
    const deptScorecards = scorecards.filter((sc) => userIds.includes(sc.user.id));
    const qaPassRate =
      deptScorecards.length > 0
        ? Math.round(
            deptScorecards.reduce((s, c) => s + c.qaPassRate, 0) / deptScorecards.length
          )
        : 100;

    const expectedWrapUps = Math.max(userIds.length, 1);
    const wrapUpCompletionPct = getWrapUpCompletionPctForUsers(userIds);

    let score = 100;
    const factors: string[] = [];
    if (overdueTasks > 0) {
      score -= Math.min(30, overdueTasks * 4);
      factors.push(`${overdueTasks} overdue`);
    }
    if (qaPassRate < 85) {
      score -= Math.min(20, 85 - qaPassRate);
      factors.push(`QA ${qaPassRate}%`);
    }
    if (wrapUpCompletionPct < 80) {
      score -= Math.min(15, 80 - wrapUpCompletionPct);
      factors.push("Wrap-ups incomplete");
    }
    if (activeTasks > 0 && overdueTasks / activeTasks > 0.2) {
      score -= 10;
      factors.push("High overdue ratio");
    }
    score = Math.max(0, Math.min(100, score));

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      score,
      level: healthLevelFromScore(score),
      activeTasks,
      overdueTasks,
      qaPassRate,
      wrapUpCompletionPct: Math.min(100, wrapUpCompletionPct),
      factors: factors.length ? factors : ["Operating normally"],
    };
  });
}

export async function getCommandCenterMetrics(viewer?: User): Promise<CommandCenterMetrics> {
  await ensureAppDataLoaded();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const [performance, allScorecards, projectHealthList] = await Promise.all([
    getTeamPerformanceDashboard(),
    getEmployeeScorecards(),
    getProjectHealthList(),
  ]);
  const earlyWarningByProject = buildProjectEarlyWarningMap({
    projects: store.projects,
    packages,
    users: store.users,
    settings: store.forecastSettings,
    qaReviews: store.qaReviews,
  });

  let scorecards = allScorecards;
  if (viewer && !isHierarchyOrgWide(viewer)) {
    const visible = new Set(getVisibleUserIds(viewer, store.users, store.teams));
    scorecards = scorecards.filter((sc) => visible.has(sc.user.id));
  }

  const acc = performance.accountabilityDashboard;
  const activePackages = packages.filter((p) => p.status !== "done");
  const avgActive =
    scorecards.length > 0
      ? Math.round(
          scorecards.reduce((s, c) => s + c.metrics.activeWork, 0) / scorecards.length
        )
      : 0;

  const workloadByEmployee = scorecards.map((sc) => {
    const mine = packages.filter((p) => p.assigned_to === sc.user.id);
    const active = mine.filter((p) => p.status !== "done").length;
    let flag: "overloaded" | "underutilized" | undefined;
    if (active >= avgActive + 3 || active >= 8) flag = "overloaded";
    else if (active <= Math.max(0, avgActive - 3) && active <= 2) flag = "underutilized";
    return {
      userId: sc.user.id,
      name: sc.user.full_name,
      active,
      inProgress: mine.filter((p) => p.status === "working_on_it").length,
      overdue: mine.filter(isOverdue).length,
      stuck: mine.filter(isStuck).length,
      hours: sc.hoursLogged,
      flag,
    };
  });

  const sortedWorkload = [...workloadByEmployee].sort((a, b) => b.active - a.active);
  const mostOverloaded = sortedWorkload[0]?.active > 0 ? sortedWorkload[0] : null;
  const lowestUtil = [...workloadByEmployee]
    .sort((a, b) => a.active - b.active || a.hours - b.hours)[0];

  const teamQuality = Math.round(
    scorecards.reduce((s, c) => s + c.qualityScore, 0) / (scorecards.length || 1)
  );
  const teamOnTime = performance.avgOnTimeRate;

  const rankings = performance.rankings;
  const topPerformer = rankings[0]
    ? { userId: rankings[0].userId, name: rankings[0].name, flowScore: rankings[0].flowScore }
    : null;
  const mostImprovedEntry = acc.mostImproved[0];
  const mostImproved = mostImprovedEntry
    ? {
        userId: mostImprovedEntry.userId,
        name: mostImprovedEntry.name,
        trendDelta: mostImprovedEntry.trendDelta,
        flowScore: mostImprovedEntry.flowScore,
      }
    : null;
  const needsAttention = acc.needsAttention[0]
    ? {
        userId: acc.needsAttention[0].userId,
        name: acc.needsAttention[0].name,
        reason: acc.needsAttention[0].reason,
        flowScore: acc.needsAttention[0].flowScore,
      }
    : null;

  const projects = projectHealthList
    .filter((ph) => ph.project.status !== "archived")
    .map((ph) => {
      const ew = earlyWarningByProject[ph.project.id];
      let status: "at_risk" | "on_track" | "near_completion" = "on_track";
      if (
        ew?.severity === "critical" ||
        ew?.severity === "warning" ||
        ph.overdueCount >= 3 ||
        ph.blockedCount >= 2
      ) {
        status = "at_risk";
      } else if (ph.overallProgress >= 85) {
        status = "near_completion";
      }
      return {
        id: ph.project.id,
        name: ph.project.name,
        completedPct: ph.overallProgress,
        hoursLogged: ph.hoursLogged,
        qaRate: ph.rollup.qaPassRate,
        overdue: ph.overdueCount,
        estimatedCompletion: ph.projectedCompletion ?? null,
        status,
        daysLate: ew?.daysLate ?? null,
        landingHeadline: ew?.headline ?? null,
        primaryReason: ew?.reasons[0] ?? null,
      };
    });

  const today = new Date();
  const weekStart = subDays(today, 7);
  const correctionsToday = store.corrections.filter((c) =>
    isSameDay(parseISO(c.created_at), today)
  ).length;
  const correctionsThisWeek = store.corrections.filter(
    (c) => parseISO(c.created_at) >= weekStart
  ).length;

  const qaQueue = packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status));
  const mfrBottlenecks = store.manufacturers
    .map((m) => ({
      label: m.name,
      count: qaQueue.filter((p) => p.manufacturer_id === m.id).length,
      href: "/qa-center",
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const decliningScores = scorecards
    .map((s) => ({ sc: s, trendDelta: trendDeltaFor(s, performance.rankings) }))
    .filter(({ trendDelta }) => trendDelta < -3)
    .map(({ sc, trendDelta }) => ({
      userId: sc.user.id,
      name: sc.user.full_name,
      trendDelta,
      flowScore: sc.flowScore,
    }))
    .sort((a, b) => a.trendDelta - b.trendDelta);

  const repeatedQaFailures = scorecards
    .filter((s) => s.metrics.correctionsReceived >= 2 && s.qaPassRate < 85)
    .map((s) => ({
      userId: s.user.id,
      name: s.user.full_name,
      corrections: s.metrics.correctionsReceived,
      qaPassRate: s.qaPassRate,
    }))
    .sort((a, b) => b.corrections - a.corrections);

  const insights = generateCommandCenterInsights({
    packages,
    projects: store.projects,
    manufacturers: store.manufacturers,
    qaReviews: store.qaReviews,
    activity: store.activity,
    scorecards,
    qaQueueSize: qaQueue.length,
    correctionsToday,
    correctionsThisWeek,
  });

  const n = scorecards.length || 1;

  initProductionTracking();
  const production = getProductionStore();
  const clockedIn = production.timeClockEntries.filter(
    (e) => e.status === "active" && !e.clock_out_at
  ).length;
  const activeTaskTimers = production.taskTimeEntries.filter(
    (e) => e.status === "active" || e.status === "paused"
  ).length;
  const todayStr = appTodayDate();
  const documentsCompletedToday = production.taskFileUploads.filter((f) =>
    f.uploaded_at.startsWith(todayStr)
  ).length;
  const avgActiveWork = scorecards.reduce((s, c) => s + c.metrics.activeWork, 0) / n;
  const capacityTarget = 6;
  const capacityUtilizationPct = Math.min(
    100,
    Math.round((avgActiveWork / capacityTarget) * 100)
  );

  const wrapUpReview = getWrapUpDashboardStats(
    viewer ?? store.users.find((u) => u.role === "admin") ?? store.users[0]
  );

  const alertViewer =
    viewer ??
    store.users.find((u) => u.role === "admin") ??
    store.users[0];
  const workloadAlerts = ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(alertViewer.role)
    ? listWorkloadAlertsForViewer(alertViewer, packages, store.users)
    : [];
  const workloadAlertSummary = buildWorkloadAlertSummary(workloadAlerts);

  const helpFlags = ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(alertViewer.role)
    ? listHelpFlagsForViewer(alertViewer, packages, store.users)
    : [];
  const helpFlagSummary = buildHelpFlagSummary(helpFlags);

  await hydrateWorkVisibilitySettings();
  const visibilityViewer = viewer ?? alertViewer;
  const { summary: workVisibility, activityGaps } = buildScopedWorkVisibility(
    visibilityViewer,
    store.users,
    packages
  );

  await ensureProjectMetricsHydrated();
  const outcomeMetrics = buildExecutiveOutcomeMetrics();

  let validationSummary: CommandCenterMetrics["validationSummary"];
  if (viewer && hasPermission(viewer.role, "validation:view")) {
    try {
      const { getValidationCenterKpis } = await import("@/lib/validation-center/runs");
      validationSummary = await getValidationCenterKpis();
    } catch {
      validationSummary = undefined;
    }
  }

  return {
    teamHealth: {
      flowScore: acc.departmentAvgFlowScore,
      productivityScore: acc.teamProductivity,
      qualityScore: teamQuality,
      onTimeScore: teamOnTime,
      topPerformer,
      mostImproved,
      needsAttention,
      mostOverloaded: mostOverloaded
        ? {
            userId: mostOverloaded.userId,
            name: mostOverloaded.name,
            active: mostOverloaded.active,
            hours: mostOverloaded.hours,
          }
        : null,
      lowestUtilization: lowestUtil
        ? {
            userId: lowestUtil.userId,
            name: lowestUtil.name,
            active: lowestUtil.active,
            hours: lowestUtil.hours,
          }
        : null,
      scoreExplanations: {
        flow: {
          title: `Team ${OPS_COPY.operationsScore}`,
          value: acc.departmentAvgFlowScore,
          formula: `Average employee ${OPS_COPY.operationsScore.toLowerCase()} (40% productivity + 30% quality + 20% on-time + 10% activity)`,
          source: `${scorecards.length} active employees`,
          drilldownHref: "/performance",
          factors: scorecards.slice(0, 5).map((s) => ({
            label: s.user.full_name,
            value: s.flowScore,
          })),
        },
        productivity: {
          title: "Team Productivity Score",
          value: acc.teamProductivity,
          formula: "Average completions, hours logged, and velocity per employee (7-day window)",
          source: `${scorecards.reduce((s, c) => s + c.completedThisWeek, 0)} completions this week`,
          drilldownHref: "/performance",
        },
        quality: {
          title: "Team Quality Score",
          value: teamQuality,
          formula: "Average QA pass rate and correction penalty across employees",
          source: `${computeQaPassRate(store.qaReviews)}% QA pass rate on ${store.qaReviews.length} reviews`,
          drilldownHref: "/qa-center",
        },
        onTime: {
          title: "Team On-Time Score",
          value: teamOnTime,
          formula: "Average on-time completion rate across employee packages",
          source: `${packages.filter(isOverdue).length} packages currently overdue`,
          drilldownHref: "/operations",
        },
      },
    },
    workload: {
      active: activePackages.length,
      inProgress: packages.filter((p) => p.status === "working_on_it").length,
      readyForQa: packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status)).length,
      correctionNeeded: packages.filter(
        (p) => p.status === "correction_needed" || ["minor_correction", "major_correction"].includes(p.qa_status)
      ).length,
      overdue: packages.filter(isOverdue).length,
      stuck: packages.filter(isStuck).length,
      avgActivePerEmployee: avgActive,
      byEmployee: workloadByEmployee,
    },
    projectHealth: {
      active: projects.length,
      atRisk: projects.filter((p) => p.status === "at_risk").length,
      onTrack: projects.filter((p) => p.status === "on_track").length,
      nearCompletion: projects.filter((p) => p.status === "near_completion").length,
      projects,
    },
    qaHealth: {
      queueSize: qaQueue.length,
      avgTurnaroundHours: computeQaTurnaroundHours(packages, store.activity, store.qaReviews),
      passRate: computeQaPassRate(store.qaReviews),
      correctionsToday,
      correctionsThisWeek,
      bottlenecks: mfrBottlenecks,
      highCorrectionAnalysts: acc.highestCorrectionRate,
    },
    accountability: {
      overdueEmployees: acc.mostOverdue,
      stuckEmployees: scorecards
        .filter((s) => s.stuckItems > 0)
        .map((s) => ({ userId: s.user.id, name: s.user.full_name, count: s.stuckItems }))
        .sort((a, b) => b.count - a.count),
      decliningScores,
      repeatedQaFailures,
      attentionList: buildAttentionList(scorecards, performance.rankings),
    },
    insights,
    trends30: acc.trends30,
    wrapUpReview,
    forecast: buildForecastDashboardStats(viewer),
    workforce: {
      clockedIn,
      activeTaskTimers,
      documentsCompletedToday,
      capacityUtilizationPct,
    },
    workVisibility,
    activityGaps,
    departmentHealth: buildDepartmentHealth(store, packages, scorecards),
    recentActivity: store.activity.slice(0, 20),
    workloadAlerts,
    workloadAlertSummary,
    helpFlags,
    helpFlagSummary,
    outcomeMetrics,
    validationSummary,
  };
}
