import type { Project, WorkPackage } from "@/types/flow";

/**
 * What a "unit" of work is. SI counts files; ID³ counts lines or records;
 * other teams count VINs, ROs, batches… Label only — forecast math never
 * changes. The unit is a PROJECT field (defaulted from the team operating
 * model's forecastRules.defaultUnit), inherited by tasks unless a task
 * overrides it — one authoritative source every surface renders from.
 */
export const FORECAST_UNITS: { value: string; plural: string; singular: string }[] = [
  { value: "files", plural: "files", singular: "file" },
  { value: "documents", plural: "documents", singular: "document" },
  { value: "lines", plural: "lines", singular: "line" },
  { value: "records", plural: "records", singular: "record" },
  { value: "VINs", plural: "VINs", singular: "VIN" },
  { value: "ROs", plural: "ROs", singular: "RO" },
  { value: "batches", plural: "batches", singular: "batch" },
  { value: "models", plural: "models", singular: "model" },
  { value: "rules", plural: "rules", singular: "rule" },
];

export function forecastUnitLabels(unit?: string | null): { plural: string; singular: string } {
  const found = FORECAST_UNITS.find((u) => u.value === (unit ?? "files"));
  return found ?? { plural: unit ?? "files", singular: unit ?? "file" };
}

/** The project's counting unit: own field → team model default → "files". */
export function resolveProjectUnit(
  project: Pick<Project, "forecast_unit"> | null | undefined,
  model?: { forecastRules?: { defaultUnit?: string } } | null
): string {
  return project?.forecast_unit ?? model?.forecastRules?.defaultUnit ?? "files";
}

/** A task's effective unit: its own override → the project's unit. */
export function resolveTaskUnit(
  task: Pick<WorkPackage, "forecast_unit"> | null | undefined,
  projectUnit: string
): string {
  return task?.forecast_unit ?? projectUnit;
}
