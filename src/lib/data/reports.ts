import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import { getWorkPackages } from "@/lib/data/work-packages";
import {
  completedThisWeek,
  completedToday,
  computeAvgCompletionHours,
  computeQaPassRate,
} from "@/lib/scoring/flow-score";
import { isOverdue, isStuck } from "@/lib/scoring/flow-score";
import type { ReportMetrics } from "@/types/flow";

export async function getReportMetrics(): Promise<ReportMetrics> {
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const [scorecards, teamPerf] = await Promise.all([
    getEmployeeScorecards(),
    getTeamPerformanceDashboard(),
  ]);

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

  const efficiencyByProject = store.projects.map((p) => {
    const projectPkgs = packages.filter((pkg) => pkg.project_id === p.id && pkg.status === "done");
    return {
      name: p.name,
      completed: projectPkgs.length,
      avgHours: computeAvgCompletionHours(projectPkgs),
    };
  });

  const efficiencyByManufacturer = store.manufacturers.slice(0, 6).map((m) => {
    const mfrPkgs = packages.filter((pkg) => pkg.manufacturer_id === m.id && pkg.status === "done");
    return {
      name: m.name,
      completed: mfrPkgs.length,
      avgHours: computeAvgCompletionHours(mfrPkgs),
    };
  });

  const performanceTrends = teamPerf.trends.map((t) => ({
    date: t.label,
    flowScore: t.flowScore,
  }));

  return {
    productivityByAnalyst,
    qaPassRate: computeQaPassRate(store.qaReviews),
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
      projects: store.projects.length,
      manufacturers: store.manufacturers.length,
      years: store.yearWorkItems.length,
      packages: packages.length,
    },
  };
}
