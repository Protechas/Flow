import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { isActiveProject } from "@/lib/data/entity-filters";
import { buildExecutiveOutcomeMetrics } from "@/lib/metrics/project-metrics-aggregate";
import { resolveProjectMetrics } from "@/lib/metrics/project-metrics-resolver";
import type { ExecutiveOutcomeMetric, ProjectMetricExportRow, ProjectMetricView } from "@/types/flow";

function formatTrend(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value}`;
}

export function buildProjectMetricExportRows(projectIds?: string[]): ProjectMetricExportRow[] {
  initFlowStore();
  const store = getFlowStore();
  const idSet = projectIds?.length ? new Set(projectIds) : null;

  const projects = store.projects.filter((p) => {
    if (p.status === "archived") return false;
    if (idSet && !idSet.has(p.id)) return false;
    return true;
  });

  const rows: ProjectMetricExportRow[] = [];
  for (const project of projects) {
    const metrics = resolveProjectMetrics(project);
    for (const metric of metrics) {
      rows.push({
        projectId: project.id,
        projectName: project.name,
        metricName: metric.metric_name,
        metricType: metric.metric_type,
        value: metric.resolved_value,
        target: metric.target_value != null ? String(metric.target_value) : "—",
        previous: metric.previous_value ?? null,
        trend7d: formatTrend(metric.trend_7d ?? null),
        trend30d: formatTrend(metric.trend_30d ?? null),
        isFormula: metric.is_formula,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.projectName.localeCompare(b.projectName) ||
      a.metricName.localeCompare(b.metricName)
  );
}

export function buildProjectOutcomeSummary(): ExecutiveOutcomeMetric[] {
  return buildExecutiveOutcomeMetrics();
}

export function resolveProjectCustomMetrics(projectId: string): ProjectMetricView[] {
  initFlowStore();
  const project = getFlowStore().projects.find((p) => p.id === projectId);
  if (!project) return [];
  return resolveProjectMetrics(project);
}

export function buildAnalyticsOutcomesByProject(): {
  projectId: string;
  projectName: string;
  metrics: { name: string; value: string; target: string | null }[];
}[] {
  initFlowStore();
  return getFlowStore()
    .projects.filter(isActiveProject)
    .map((project) => {
      const metrics = resolveProjectMetrics(project);
      if (!metrics.length) return null;
      return {
        projectId: project.id,
        projectName: project.name,
        metrics: metrics.map((m) => ({
          name: m.metric_name,
          value: m.resolved_value,
          target: m.target_value != null ? String(m.target_value) : null,
        })),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}
