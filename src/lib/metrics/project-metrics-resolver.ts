import { projectRollup } from "@/lib/hierarchy/rollups";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import {
  evaluateMetricFormula,
  formatMetricValue,
  parseMetricNumeric,
} from "@/lib/metrics/project-metrics-formulas";
import {
  listProjectMetricDefinitions,
  listProjectMetricValues,
} from "@/lib/metrics/project-metrics-store";
import type {
  Project,
  ProjectMetricView,
  RollupMetrics,
  WorkPackage,
} from "@/types/flow";
import { parseISO } from "date-fns";

function buildRollup(project: Project, packages: WorkPackage[]): RollupMetrics {
  const store = getFlowStore();
  return projectRollup(
    project,
    packages,
    store.manufacturers,
    store.qaReviews,
    store.yearWorkItems,
    store.activity
  );
}

function valueAtOrBefore(
  definitionId: string,
  daysAgo: number
): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAgo);
  const history = listProjectMetricValues(definitionId, 200);
  const entry = history.find((h) => {
    try {
      return parseISO(h.updated_at) <= cutoff;
    } catch {
      return false;
    }
  });
  if (!entry) return null;
  const def = listProjectMetricDefinitions().find((d) => d.id === definitionId);
  return parseMetricNumeric(def?.metric_type ?? "number", entry.current_value);
}

function computeTrend(
  definitionId: string,
  metricType: string,
  currentNumeric: number | null
): { trend7: number | null; trend30: number | null } {
  if (currentNumeric === null || metricType === "status" || metricType === "boolean") {
    return { trend7: null, trend30: null };
  }
  const prev7 = valueAtOrBefore(definitionId, 7);
  const prev30 = valueAtOrBefore(definitionId, 30);
  return {
    trend7: prev7 !== null ? currentNumeric - prev7 : null,
    trend30: prev30 !== null ? currentNumeric - prev30 : null,
  };
}

export function resolveProjectMetrics(
  project: Project,
  packages?: WorkPackage[],
  documentsProcessed?: number,
  filesUploaded?: number
): ProjectMetricView[] {
  initFlowStore();
  const store = getFlowStore();
  const projectPackages = packages ?? store.workPackages.filter((p) => p.project_id === project.id);
  const rollup = buildRollup(project, projectPackages);
  const definitions = listProjectMetricDefinitions(project.id);

  return definitions.map((def) => {
    let resolved = def.current_value ?? "";
    let numeric: number | null = parseMetricNumeric(def.metric_type, resolved);

    if (def.is_formula && def.formula_definition) {
      const computed = evaluateMetricFormula(def.formula_definition, {
        project,
        rollup,
        documentsProcessed,
        filesUploaded,
      });
      resolved = computed.value;
      numeric = computed.numeric;
    } else if (resolved) {
      resolved = formatMetricValue(def.metric_type, resolved, def.target_value);
    } else {
      resolved = "—";
    }

    const history = listProjectMetricValues(def.id, 2);
    const previous = history[1]?.current_value ?? history[0]?.previous_value ?? null;
    const { trend7, trend30 } = computeTrend(def.id, def.metric_type, numeric);

    return {
      ...def,
      resolved_value: resolved,
      numeric_value: numeric,
      previous_value: previous,
      trend_7d: trend7,
      trend_30d: trend30,
    };
  });
}

export function resolveProjectMetricsById(projectId: string): ProjectMetricView[] {
  initFlowStore();
  const project = getFlowStore().projects.find((p) => p.id === projectId);
  if (!project) return [];
  return resolveProjectMetrics(project);
}
