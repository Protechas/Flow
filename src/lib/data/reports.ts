import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore } from "@/lib/data/flow-store";
import { filterWorkPackagesToTeam } from "@/lib/auth/team-scope";
import { getWorkPackages } from "@/lib/data/work-packages";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import {
  completedThisWeek,
  completedToday,
  computeAvgCompletionHours,
  computeQaPassRate,
} from "@/lib/scoring/flow-score";
import { isOverdue, isStuck } from "@/lib/scoring/flow-score";
import { buildForecastReportMetrics } from "@/lib/forecast/metrics";
import { buildWorkloadAlertReportMetrics } from "@/lib/workload-alerts/engine";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { buildHelpFlagReportMetrics } from "@/lib/help-flags/engine";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { ensureProjectMetricsHydrated } from "@/lib/data/project-metrics-db";
import {
  buildProjectMetricExportRows,
  buildProjectOutcomeSummary,
} from "@/lib/metrics/project-metrics-reporting";
import type { ReportMetrics } from "@/types/flow";

export async function getReportMetrics(teamMemberIds?: string[]): Promise<ReportMetrics> {
  await ensureAppDataLoaded();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  await ensureProjectMetricsHydrated();
  const store = getFlowStore();
  let packages = await getWorkPackages();
  if (teamMemberIds?.length) {
    packages = filterWorkPackagesToTeam(packages, teamMemberIds);
  }

  let scorecards = await getEmployeeScorecards();
  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    scorecards = scorecards.filter((s) => ids.has(s.user.id));
  }

  const teamPerf = await getTeamPerformanceDashboard();

  const productivityByAnalyst = scorecards.map((s) => ({
    name: s.user.full_name,
    completed: s.completedThisMonth,
    hours: s.hoursLogged,
  }));

  const workloadByAnalyst = scorecards.map((s) => ({
    name: s.user.full_name,
    active: s.currentWork.length,
    hours: s.hoursLogged,
  }));

  const projectIds = new Set(packages.map((p) => p.project_id));
  const mfrIds = new Set(packages.map((p) => p.manufacturer_id));

  const efficiencyByProject = store.projects
    .filter((p) => projectIds.has(p.id))
    .map((p) => {
      const projectPkgs = packages.filter((pkg) => pkg.project_id === p.id && pkg.status === "done");
      return {
        name: p.name,
        completed: projectPkgs.length,
        avgHours: computeAvgCompletionHours(projectPkgs),
      };
    });

  const efficiencyByManufacturer = store.manufacturers
    .filter((m) => mfrIds.has(m.id))
    .slice(0, 6)
    .map((m) => {
      const mfrPkgs = packages.filter((pkg) => pkg.manufacturer_id === m.id && pkg.status === "done");
      return {
        name: m.name,
        completed: mfrPkgs.length,
        avgHours: computeAvgCompletionHours(mfrPkgs),
      };
    });

  const qaReviews = teamMemberIds?.length
    ? store.qaReviews.filter((r) => teamMemberIds.includes(r.analyst_id))
    : store.qaReviews;

  const performanceTrends = teamPerf.trends.map((t) => ({
    date: t.label,
    flowScore: t.flowScore,
  }));

  const projectIdsList = [...projectIds];

  return {
    productivityByAnalyst,
    qaPassRate: computeQaPassRate(qaReviews),
    totalCorrections: packages.reduce((s, p) => s + p.correction_count, 0),
    avgTimePerPackage: computeAvgCompletionHours(packages.filter((p) => p.status === "done")),
    overdueCount: packages.filter(isOverdue).length,
    stuckCount: packages.filter(isStuck).length,
    completedByPeriod: [
      { period: "Today", count: completedToday(packages) },
      { period: "This Week", count: completedThisWeek(packages) },
      { period: "This Month", count: packages.filter((p) => p.status === "done").length },
    ],
    workloadByAnalyst,
    efficiencyByProject,
    efficiencyByManufacturer,
    performanceTrends,
    hierarchySummary: {
      projects: new Set(packages.map((p) => p.project_id)).size,
      manufacturers: new Set(packages.map((p) => p.manufacturer_id)).size,
      years: new Set(packages.map((p) => `${p.manufacturer_id}-${p.year}`)).size,
      packages: packages.length,
    },
    forecast: buildForecastReportMetrics(teamMemberIds),
    workloadAlerts: buildWorkloadAlertReportMetrics(
      packages,
      store.users,
      teamMemberIds
    ),
    helpFlags: buildHelpFlagReportMetrics(store.users, teamMemberIds),
    outcomeMetrics: buildProjectOutcomeSummary(),
    projectMetricRows: buildProjectMetricExportRows(projectIdsList),
  };
}
