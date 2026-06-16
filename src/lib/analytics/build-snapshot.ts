import { filterWorkPackagesToTeam } from "@/lib/auth/team-scope";
import { getVisibleUserIds, isOrgWideRole } from "@/lib/hierarchy/resolver";
import { getDepartmentName } from "@/lib/departments/resolve";
import { buildAllDepartmentReports } from "@/lib/departments/reports";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import { getProjectHealthList } from "@/lib/data/project-health";
import { getWorkPackages } from "@/lib/data/work-packages";
import {
  getProductionReport,
  getProductionStore,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { healthLevelFromScore, type DepartmentHealthSummary } from "@/lib/design/department-health";
import { buildForecastReportMetrics } from "@/lib/forecast/metrics";
import { buildHelpFlagReportMetrics } from "@/lib/help-flags/engine";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import {
  computeQaPassRate,
  isOverdue,
  isStuck,
} from "@/lib/scoring/flow-score";
import { getWrapUpDashboardStats } from "@/lib/wrap-up/review";
import { buildWorkloadAlertReportMetrics } from "@/lib/workload-alerts/engine";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { listWorkloadAlertRecords } from "@/lib/workload-alerts/store";
import { listHelpFlagRecords } from "@/lib/help-flags/store";
import type { EmployeeScorecard, User, WorkPackage } from "@/types/flow";
import { format, isSameDay, parseISO, subDays } from "date-fns";
import type {
  AnalyticsEmployeeSpeed,
  AnalyticsManagerInsight,
  AnalyticsProjectRisk,
  AnalyticsTeamQa,
  AnalyticsWorkloadEmployee,
  FlowAnalyticsSnapshot,
} from "./types";

function buildDepartmentHealth(
  store: ReturnType<typeof getFlowStore>,
  packages: WorkPackage[],
  scorecards: EmployeeScorecard[],
  wrapUpSubmittedToday: number
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
    const wrapUpCompletionPct = Math.round((wrapUpSubmittedToday / expectedWrapUps) * 100);

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

function buildEmployeeSpeedRankings(
  production: ReturnType<typeof getProductionReport>,
  scorecards: EmployeeScorecard[],
  minFiles = 1
): AnalyticsEmployeeSpeed[] {
  const flowByUser = new Map(scorecards.map((s) => [s.user.id, s.flowScore]));

  return production.byEmployee
    .filter((e) => e.fileCount >= minFiles)
    .map((e) => ({
      userId: e.userId,
      name: e.name,
      docsPerHour: e.docsPerHour,
      avgMinutesPerDocument:
        e.fileCount > 0 ? Math.round((e.totalMinutes / e.fileCount) * 100) / 100 : 0,
      submissions: e.submissions,
      fileCount: e.fileCount,
      flowScore: flowByUser.get(e.userId) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.docsPerHour - a.docsPerHour || a.avgMinutesPerDocument - b.avgMinutesPerDocument)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

function buildWorkloadEmployees(
  packages: WorkPackage[],
  scorecards: EmployeeScorecard[],
  needsWorkUserIds: Set<string>
): AnalyticsWorkloadEmployee[] {
  const avgActive =
    scorecards.length > 0
      ? Math.round(
          scorecards.reduce((s, c) => s + c.metrics.activeWork, 0) / scorecards.length
        )
      : 0;

  return scorecards.map((sc) => {
    const mine = packages.filter((p) => p.assigned_to === sc.user.id);
    const active = mine.filter((p) => p.status !== "done").length;
    let flag: AnalyticsWorkloadEmployee["flag"];
    if (needsWorkUserIds.has(sc.user.id)) flag = "needs_work";
    else if (active >= avgActive + 3 || active >= 8) flag = "overloaded";
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
}

function buildQaByTeam(
  store: ReturnType<typeof getFlowStore>,
  teamMemberIds?: string[]
): AnalyticsTeamQa[] {
  return store.teams
    .map((team) => {
      const memberIds = store.users
        .filter((u) => u.team_id === team.id && u.is_active)
        .map((u) => u.id)
        .filter((id) => !teamMemberIds?.length || teamMemberIds.includes(id));

      if (memberIds.length === 0) return null;

      const reviews = store.qaReviews.filter((r) => memberIds.includes(r.analyst_id));
      const corrections = store.corrections.filter((c) => memberIds.includes(c.assigned_to));

      return {
        teamId: team.id,
        teamName: team.name,
        departmentName: getDepartmentName(team.department_id),
        passRate: computeQaPassRate(reviews),
        reviewCount: reviews.length,
        corrections: corrections.length,
      };
    })
    .filter((t): t is AnalyticsTeamQa => t != null && t.reviewCount > 0)
    .sort((a, b) => b.passRate - a.passRate || b.reviewCount - a.reviewCount);
}

function buildManagerInsights(scorecards: EmployeeScorecard[], rankings: { userId: string; trendDelta: number }[]): AnalyticsManagerInsight[] {
  const trendMap = new Map(rankings.map((r) => [r.userId, r.trendDelta]));
  const items: AnalyticsManagerInsight[] = [];

  for (const sc of scorecards) {
    const trendDelta = trendMap.get(sc.user.id) ?? 0;
    if (sc.overdueItems >= 2 || sc.stuckItems > 0) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "coaching",
        reason:
          sc.stuckItems > 0
            ? `${sc.stuckItems} stuck · ${sc.overdueItems} overdue`
            : `${sc.overdueItems} overdue packages`,
        flowScore: sc.flowScore,
        priority: sc.stuckItems > 0 ? 90 : 70 + sc.overdueItems,
      });
    }
    if (trendDelta < -5) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "support",
        reason: `Flow Score declining (${trendDelta})`,
        flowScore: sc.flowScore,
        priority: 60 + Math.abs(trendDelta),
      });
    }
    if (sc.metrics.correctionsReceived >= 3 && sc.qaPassRate < 80) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "coaching",
        reason: `${sc.metrics.correctionsReceived} QA corrections · ${sc.qaPassRate}% pass`,
        flowScore: sc.flowScore,
        priority: 75,
      });
    }
    if (sc.flowScore >= 85 && trendDelta >= 3) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "recognition",
        reason: `Top performer · +${trendDelta} trend`,
        flowScore: sc.flowScore,
        priority: 100 - sc.flowScore,
      });
    }
    if (sc.metrics.activeWork >= 8) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "support",
        reason: `Overloaded — ${sc.metrics.activeWork} active packages`,
        flowScore: sc.flowScore,
        priority: 80,
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
    .slice(0, 15);
}

function buildProjectRisks(
  projectHealthList: Awaited<ReturnType<typeof getProjectHealthList>>,
  forecastAtRiskIds: Set<string>
): AnalyticsProjectRisk[] {
  return projectHealthList
    .filter((ph) => ph.project.status !== "archived")
    .map((ph) => {
      let status: AnalyticsProjectRisk["status"] = "on_track";
      if (ph.overdueCount >= 3 || ph.blockedCount >= 2) status = "at_risk";
      else if (ph.overallProgress >= 85) status = "near_completion";

      return {
        projectId: ph.project.id,
        name: ph.project.name,
        completedPct: ph.overallProgress,
        overdue: ph.overdueCount,
        qaRate: ph.rollup.qaPassRate,
        status,
        behindForecast: forecastAtRiskIds.has(ph.project.id),
      };
    })
    .filter((p) => p.status === "at_risk" || p.behindForecast)
    .sort((a, b) => b.overdue - a.overdue);
}

export async function buildFlowAnalyticsSnapshot(
  viewer: User,
  options?: { periodDays?: number; teamMemberIds?: string[] }
): Promise<FlowAnalyticsSnapshot> {
  const periodDays = options?.periodDays ?? 30;
  initFlowStore();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  const store = getFlowStore();

  let packages = await getWorkPackages();
  let teamMemberIds = options?.teamMemberIds;
  if (!teamMemberIds && viewer && !isOrgWideRole(viewer.role)) {
    teamMemberIds = getVisibleUserIds(viewer, store.users, store.teams);
  }
  if (teamMemberIds?.length) {
    packages = filterWorkPackagesToTeam(packages, teamMemberIds);
  }

  const startDate = format(subDays(new Date(), periodDays), "yyyy-MM-dd");
  const production = getProductionReport({
    startDate,
    userIds: teamMemberIds,
  });

  const [performance, allScorecards, projectHealthList] = await Promise.all([
    getTeamPerformanceDashboard(),
    getEmployeeScorecards(),
    getProjectHealthList(),
  ]);

  let scorecards = allScorecards;
  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    scorecards = scorecards.filter((sc) => ids.has(sc.user.id));
  }

  const forecast = buildForecastReportMetrics(teamMemberIds);
  const workloadAlerts = buildWorkloadAlertReportMetrics(packages, store.users, teamMemberIds);
  const helpFlagRecords = listHelpFlagRecords().filter((r) =>
    teamMemberIds?.length ? teamMemberIds.includes(r.employee_id) : true
  );
  const criticalHelpFlags = helpFlagRecords.filter(
    (r) =>
      r.severity === "critical" &&
      ["open", "acknowledged", "in_progress"].includes(r.status)
  ).length;
  const helpFlags = buildHelpFlagReportMetrics(store.users, teamMemberIds);
  const wrapUpStats = getWrapUpDashboardStats(viewer);

  const needsWorkUserIds = new Set<string>();
  for (const r of listWorkloadAlertRecords()) {
    if (r.status !== "open") continue;
    if (teamMemberIds?.length && !teamMemberIds.includes(r.employee_id)) continue;
    if (
      r.alert_type === "no_assigned_work" ||
      r.alert_type === "needs_more_work_soon" ||
      r.alert_type === "running_out_of_work"
    ) {
      needsWorkUserIds.add(r.employee_id);
    }
  }

  const workload = buildWorkloadEmployees(packages, scorecards, needsWorkUserIds);
  const speedRankings = buildEmployeeSpeedRankings(production, scorecards);
  const departmentHealth = buildDepartmentHealth(
    store,
    packages,
    scorecards,
    wrapUpStats.submittedToday
  );

  const deptReports = buildAllDepartmentReports(
    listDepartments().filter((d) => d.status === "active"),
    { startDate, userIds: teamMemberIds }
  );

  const qaByTeam = buildQaByTeam(store, teamMemberIds);
  const today = new Date();
  const weekStart = subDays(today, 7);
  const scopedReviews = teamMemberIds?.length
    ? store.qaReviews.filter((r) => teamMemberIds.includes(r.analyst_id))
    : store.qaReviews;

  const correctionsToday = store.corrections.filter((c) =>
    isSameDay(parseISO(c.created_at), today)
  ).length;
  const correctionsWeek = store.corrections.filter(
    (c) => parseISO(c.created_at) >= weekStart
  ).length;

  const qaByDepartment = departmentHealth.map((d) => ({
    departmentId: d.departmentId,
    departmentName: d.departmentName,
    passRate: d.qaPassRate,
    reviewCount: scopedReviews.filter((r) => {
      const analyst = store.users.find((u) => u.id === r.analyst_id);
      const team = store.teams.find((t) => t.id === analyst?.team_id);
      return team?.department_id === d.departmentId;
    }).length,
  }));

  initProductionTracking();
  const prodStore = getProductionStore();
  const clockedIn = prodStore.timeClockEntries.filter(
    (e) => e.status === "active" && !e.clock_out_at
  ).length;
  const activeTaskTimers = prodStore.taskTimeEntries.filter(
    (e) => e.status === "active" || e.status === "paused"
  ).length;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const documentsCompletedToday = prodStore.taskFileUploads.filter((f) =>
    f.uploaded_at.startsWith(todayStr)
  ).length;

  const n = scorecards.length || 1;
  const avgActiveWork = scorecards.reduce((s, c) => s + c.metrics.activeWork, 0) / n;
  const capacityTarget = 6;
  const capacityUtilizationPct = Math.min(100, Math.round((avgActiveWork / capacityTarget) * 100));

  const forecastAtRiskProjectIds = new Set(forecast.atRiskProjects.map((p) => p.id));
  const projectsFallingBehind = buildProjectRisks(projectHealthList, forecastAtRiskProjectIds);

  const struggling = [...departmentHealth]
    .filter((d) => d.level === "at_risk" || d.level === "critical" || d.score < 75)
    .sort((a, b) => a.score - b.score);

  const overloaded = workload.filter((w) => w.flag === "overloaded").sort((a, b) => b.active - a.active);
  const underutilized = workload
    .filter((w) => w.flag === "underutilized")
    .sort((a, b) => a.active - b.active);
  const needsWork = workload.filter((w) => w.flag === "needs_work");

  const scopeLabel = teamMemberIds?.length
    ? `Scoped · ${scorecards.length} employees`
    : "Organization-wide";

  const minutesPerDocumentTrend = production.trends.map((t) => ({
    date: t.date,
    value:
      t.submissions > 0 && t.totalMinutes > 0
        ? Math.round((t.totalMinutes / Math.max(1, t.submissions)) * 100) / 100
        : production.avgMinutesPerDocument,
  }));

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    scopeLabel,
    headline: {
      fastestEmployee: speedRankings[0] ?? null,
      mostOverloaded: overloaded[0] ?? null,
      mostUnderutilized: underutilized[0] ?? null,
      employeesNeedingWork: needsWork.length,
      strugglingDepartment: struggling[0] ?? null,
      projectsBehind: projectsFallingBehind.length,
      orgAvgMinutesPerDocument: production.avgMinutesPerDocument,
      topQaTeam: qaByTeam[0] ?? null,
    },
    employee: {
      speedRankings: speedRankings.slice(0, 12),
      workload,
      overloaded,
      underutilized,
      needsWork,
      flowScoreLeaders: performance.rankings.slice(0, 8).map((r) => ({
        userId: r.userId,
        name: r.name,
        flowScore: r.flowScore,
        trendDelta: r.trendDelta,
      })),
    },
    department: {
      health: departmentHealth.sort((a, b) => a.score - b.score),
      production: deptReports.map((d) => {
        const prod = production.byDepartment.find((x) => x.departmentId === d.departmentId);
        return {
          departmentId: d.departmentId,
          name: d.departmentName,
          submissions: prod?.submissions ?? 0,
          fileCount: prod?.fileCount ?? 0,
          hoursWorked: prod?.hoursWorked ?? d.hoursWorked,
          avgMinutesPerDocument:
            prod && prod.fileCount > 0
              ? Math.round((prod.totalMinutes / prod.fileCount) * 100) / 100
              : d.avgMinutesPerDocument,
        };
      }),
      struggling,
    },
    manager: {
      teamFlowScore: performance.teamFlowScore,
      avgQaPassRate: performance.avgQaPassRate,
      avgOnTimeRate: performance.avgOnTimeRate,
      insights: buildManagerInsights(scorecards, performance.rankings),
      topPerformers: performance.topPerformers.slice(0, 5).map((p) => ({
        userId: p.userId,
        name: p.name,
        flowScore: p.flowScore,
      })),
      needsAttention: performance.accountabilityDashboard.needsAttention.slice(0, 8),
    },
    forecast: {
      ...forecast,
      projectsFallingBehind,
    },
    qa: {
      orgPassRate: computeQaPassRate(scopedReviews),
      correctionsToday,
      correctionsWeek,
      byTeam: qaByTeam,
      byDepartment: qaByDepartment.filter((d) => d.reviewCount > 0).sort((a, b) => b.passRate - a.passRate),
      lowPerformers: scorecards
        .filter((s) => s.qaPassRate < 85 && s.metrics.correctionsReceived > 0)
        .map((s) => ({
          userId: s.user.id,
          name: s.user.full_name,
          passRate: s.qaPassRate,
          corrections: s.metrics.correctionsReceived,
        }))
        .sort((a, b) => a.passRate - b.passRate)
        .slice(0, 8),
    },
    capacity: {
      clockedIn,
      activeTaskTimers,
      capacityUtilizationPct,
      avgActiveWorkPerEmployee: Math.round(avgActiveWork * 10) / 10,
      documentsCompletedToday,
      departmentLoad: forecast.byDepartment.map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentName,
        activeTasks: d.activeTasks,
        estimatedHours: d.estimatedHours,
      })),
      unusedCapacityHours: workloadAlerts.avgUnusedCapacityHours,
    },
    workload: {
      openAlerts: workloadAlerts.openAlerts,
      criticalAlerts: workloadAlerts.byDepartment.reduce((s, d) => s + d.criticalCount, 0),
      noWorkCount: workloadAlerts.noWorkCount,
      lowWorkloadCount: workloadAlerts.lowWorkloadCount,
      openHelpFlags: helpFlags.openCount,
      criticalHelpFlags,
      wrapUpMissing: wrapUpStats.missingToday,
      wrapUpSubmitted: wrapUpStats.submittedToday,
      byDepartmentAlerts: workloadAlerts.byDepartment,
    },
    trends: {
      production: production.trends.map((t) => ({
        date: t.date,
        avgMinutesPerDocument:
          t.submissions > 0
            ? Math.round((t.totalMinutes / Math.max(1, t.submissions)) * 100) / 100
            : 0,
        submissions: t.submissions,
        avgDocsPerHour: t.avgDocsPerHour,
      })),
      flowScore: performance.trends,
      minutesPerDocumentTrend,
    },
  };
}
