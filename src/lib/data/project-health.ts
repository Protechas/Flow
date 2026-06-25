import { projectRollup } from "@/lib/hierarchy/rollups";
import { getMockStore } from "@/lib/data/mock-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { ensureProjectMetricsHydrated } from "@/lib/data/project-metrics-db";
import { resolveProjectMetrics } from "@/lib/metrics/project-metrics-resolver";
import { buildProgramIntelligence, type ProgramIntelligence } from "@/lib/projects/project-intelligence";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type { ProjectHealth } from "@/types/flow";
import { addDays, format } from "date-fns";

export async function getProjectHealthList(): Promise<ProjectHealth[]> {
  await hydrateForecastSettings();
  await ensureProjectMetricsHydrated();
  initFlowStore();
  const forecastSettings = getFlowStore().forecastSettings;
  const store = getMockStore();
  const packages = await getWorkPackages();

  return store.projects.map((project) => {
    const projectPkgs = packages.filter((p) => p.project_id === project.id);
    const rollup = projectRollup(project, projectPkgs, store.manufacturers, store.qaReviews, store.yearWorkItems.filter((y) => y.project_id === project.id));
    const mfrs = store.manufacturers.filter((m) => m.project_id === project.id);

    const manufacturerProgress = mfrs.map((m) => {
      const mfrPkgs = projectPkgs.filter((p) => p.manufacturer_id === m.id);
      const done = mfrPkgs.filter((p) => p.status === "done").length;
      return {
        name: m.name,
        completedPct: mfrPkgs.length ? Math.round((done / mfrPkgs.length) * 100) : 0,
        packages: mfrPkgs.length,
      };
    });

    const hoursLogged = rollup.hoursLogged;
    const estimatedRemaining = Math.max(0, rollup.estimatedHours - hoursLogged);
    const hoursPerDay = forecastSettings.productive_hours_per_day ?? 6.5;
    const projectedDays =
      estimatedRemaining > 0 ? Math.ceil(estimatedRemaining / hoursPerDay) : 0;

    const analystIds = [...new Set(projectPkgs.map((p) => p.assigned_to).filter(Boolean))] as string[];
    const assignedAnalysts = analystIds.map(
      (id) => store.users.find((u) => u.id === id)?.full_name ?? id
    );

    return {
      project,
      overallProgress: rollup.completedPct,
      manufacturerProgress,
      hoursLogged,
      estimatedRemaining,
      qaIssues: projectPkgs.filter((p) =>
        ["correction_needed", "minor_correction", "major_correction", "rejected"].includes(p.qa_status)
      ).length,
      blockedCount: rollup.stuckCount,
      overdueCount: rollup.overdueCount,
      assignedAnalysts,
      projectedCompletion:
        projectedDays > 0 ? format(addDays(new Date(), projectedDays), "yyyy-MM-dd") : null,
      rollup,
      customMetrics: resolveProjectMetrics(project),
    };
  });
}

export async function getProjectHealthIntelligenceMap(): Promise<Record<string, ProgramIntelligence>> {
  await hydrateForecastSettings();
  initFlowStore();
  const forecastSettings = getFlowStore().forecastSettings;
  const store = getMockStore();
  const packages = await getWorkPackages();
  const map: Record<string, ProgramIntelligence> = {};

  for (const project of store.projects) {
    if (project.status === "archived") continue;
    const projectPkgs = packages.filter((p) => p.project_id === project.id);
    const rollup = projectRollup(
      project,
      projectPkgs,
      store.manufacturers,
      store.qaReviews,
      store.yearWorkItems.filter((y) => y.project_id === project.id)
    );
    const withStats: ProjectWithStats = {
      ...project,
      manufacturerCount: rollup.manufacturerCount,
      yearCount: rollup.yearCount,
      completedPct: rollup.completedPct,
    };
    map[project.id] = buildProgramIntelligence(
      withStats,
      packages,
      store.manufacturers,
      store.yearWorkItems,
      store.qaReviews,
      store.activity,
      forecastSettings
    );
  }

  return map;
}
