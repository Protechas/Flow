import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { isActiveProject } from "@/lib/data/entity-filters";
import { resolveProjectMetrics } from "@/lib/metrics/project-metrics-resolver";
import type { ExecutiveOutcomeMetric, ProjectMetricType } from "@/types/flow";

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function aggregateLabel(
  metricType: ProjectMetricType,
  sum: number,
  count: number,
  isAverage: boolean
): string {
  if (count === 0) return "—";
  if (metricType === "percentage") {
    const avg = Math.round(sum / count);
    return `${avg}%`;
  }
  if (metricType === "currency") {
    return `$${Math.round(sum).toLocaleString()}`;
  }
  if (metricType === "hours") {
    return isAverage ? `${(sum / count).toFixed(1)}h avg` : `${Math.round(sum)}h`;
  }
  if (isAverage) return `${Math.round(sum / count)} avg`;
  return Math.round(sum).toLocaleString();
}

/** Roll up custom metrics across active projects by metric name */
export function buildExecutiveOutcomeMetrics(): ExecutiveOutcomeMetric[] {
  initFlowStore();
  const store = getFlowStore();
  const activeProjects = store.projects.filter(isActiveProject);

  const buckets = new Map<
    string,
    {
      metric_name: string;
      metric_type: ProjectMetricType;
      display_style: ExecutiveOutcomeMetric["display_style"];
      values: number[];
      projectIds: Set<string>;
    }
  >();

  for (const project of activeProjects) {
    const metrics = resolveProjectMetrics(project);
    for (const metric of metrics) {
      const key = slug(metric.metric_name);
      if (metric.numeric_value === null) continue;
      const bucket = buckets.get(key) ?? {
        metric_name: metric.metric_name,
        metric_type: metric.metric_type,
        display_style: metric.display_style,
        values: [],
        projectIds: new Set<string>(),
      };
      bucket.values.push(metric.numeric_value);
      bucket.projectIds.add(project.id);
      buckets.set(key, bucket);
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const sum = bucket.values.reduce((a, b) => a + b, 0);
      const isAverage = bucket.metric_type === "percentage";
      const numeric = isAverage ? sum / bucket.values.length : sum;
      return {
        id: slug(bucket.metric_name),
        metric_name: bucket.metric_name,
        metric_type: bucket.metric_type,
        display_style: bucket.display_style,
        aggregate_value: aggregateLabel(
          bucket.metric_type,
          sum,
          bucket.values.length,
          isAverage
        ),
        numeric_value: numeric,
        project_count: bucket.projectIds.size,
        unit_label: isAverage ? "avg across projects" : "total",
      } satisfies ExecutiveOutcomeMetric;
    })
    .sort((a, b) => b.project_count - a.project_count || a.metric_name.localeCompare(b.metric_name))
    .slice(0, 8);
}
