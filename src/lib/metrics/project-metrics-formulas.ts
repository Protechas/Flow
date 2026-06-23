import type { Project, ProjectMetricFormulaDefinition, RollupMetrics } from "@/types/flow";

export interface MetricFormulaContext {
  project: Project;
  rollup: RollupMetrics;
  documentsProcessed?: number;
  filesUploaded?: number;
}

export function evaluateMetricFormula(
  formula: ProjectMetricFormulaDefinition | null | undefined,
  ctx: MetricFormulaContext
): { value: string; numeric: number | null } {
  if (!formula?.kind) return { value: "—", numeric: null };

  switch (formula.kind) {
    case "qa_pass_rate":
      return fmtPct(ctx.rollup.qaPassRate);
    case "completion_pct":
      return fmtPct(ctx.rollup.completedPct);
    case "forecast_confidence":
      return fmtPct(ctx.project.forecast_confidence ?? 0);
    case "correction_count":
      return fmtNum(ctx.rollup.correctionCount);
    case "ready_for_qa":
      return fmtNum(ctx.rollup.readyForQa);
    case "hours_variance": {
      const variance = ctx.rollup.hoursLogged - ctx.rollup.estimatedHours;
      return { value: `${variance >= 0 ? "+" : ""}${variance.toFixed(1)}h`, numeric: variance };
    }
    case "documents_processed":
      return fmtNum(ctx.documentsProcessed ?? ctx.rollup.fileCount);
    case "files_uploaded":
      return fmtNum(ctx.filesUploaded ?? ctx.rollup.fileCount);
    default:
      return { value: "—", numeric: null };
  }
}

function fmtPct(n: number): { value: string; numeric: number | null } {
  const rounded = Math.round(n);
  return { value: `${rounded}%`, numeric: rounded };
}

function fmtNum(n: number): { value: string; numeric: number | null } {
  return { value: String(n), numeric: n };
}

export function parseMetricNumeric(
  metricType: string,
  raw: string | null | undefined
): number | null {
  if (!raw) return null;
  if (metricType === "boolean") return raw === "true" || raw === "1" ? 1 : 0;
  if (metricType === "status") return null;
  const cleaned = raw.replace(/[%$,h\s]/gi, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMetricValue(
  metricType: string,
  raw: string,
  target?: number | null
): string {
  if (metricType === "boolean") return raw === "true" || raw === "1" ? "Yes" : "No";
  if (metricType === "status") {
    return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (metricType === "currency") {
    const n = parseMetricNumeric(metricType, raw);
    return n !== null ? `$${n.toLocaleString()}` : raw;
  }
  if (metricType === "hours") {
    const n = parseMetricNumeric(metricType, raw);
    return n !== null ? `${n}h` : raw;
  }
  if (metricType === "percentage") {
    return raw.includes("%") ? raw : `${raw}%`;
  }
  if (metricType === "number" && target != null) {
    return `${raw} / ${target}`;
  }
  return raw;
}
