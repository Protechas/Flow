import { hoursToProductivePercent, normalizeForecastSettings } from "@/lib/forecast/capacity";
import type { ForecastSettings } from "@/types/flow";
import type { OperatingContext, OperatingModelTrackingField } from "@/lib/operating-models/types";
import type { CreationDefaults } from "@/lib/work-creation/client-defaults";
import type { SmartHierarchyLabels } from "@/lib/work-packages/smart-labels";

export function operatingModelToHierarchyLabels(
  model: OperatingContext["model"]
): Partial<SmartHierarchyLabels> {
  const h = model.hierarchyLabels;
  return {
    workPackage: h.workPackage,
    workPackageShort: h.workPackageShort ?? h.workPackage,
    workPackagePlural: h.workPackagePlural ?? `${h.workPackage}s`,
    phase: h.phase,
    phaseShort: h.phaseShort ?? h.phase,
    phasePlural: h.phasePlural ?? `${h.phase}s`,
    task: h.task ?? "Task",
    taskPlural: h.taskPlural ?? "Tasks",
  };
}

export function mergeForecastWithOperatingModel(
  global: ForecastSettings,
  model: OperatingContext["model"]
): ForecastSettings {
  const rules = model.forecastRules;
  if (!rules) return global;
  const hours =
    rules.productiveHoursPerDay ?? global.productive_hours_per_day;
  return normalizeForecastSettings({
    ...global,
    productive_hours_per_day: hours,
    productive_day_percent: hoursToProductivePercent(hours),
    minutes_per_document:
      rules.defaultMinutesPerUnit ?? global.minutes_per_document,
  });
}

export function applyOperatingModelToCreationDefaults(
  defaults: CreationDefaults,
  ctx: OperatingContext
): CreationDefaults {
  const { model, departmentId, teamId } = ctx;
  return {
    ...defaults,
    departmentId: departmentId || defaults.departmentId,
    teamId: teamId || defaults.teamId,
    complexity: defaults.complexity,
    priority: defaults.priority,
    year: defaults.year,
    manufacturerFallback: model.hierarchyLabels.workPackageShort ?? defaults.manufacturerFallback,
  };
}

export function shouldShowTrackingField(
  field: OperatingModelTrackingField,
  trackingFields: OperatingModelTrackingField[]
): boolean {
  return trackingFields.includes(field);
}

export function taskPlacementVisible(ctx: OperatingContext): {
  showWorkstream: boolean;
  showYear: boolean;
} {
  const td = ctx.model.taskDefaults;
  const tracksManufacturer =
    ctx.model.structureMode === "by_manufacturer" ||
    ctx.model.trackingFields.includes("documents");
  const tracksWorkstream = ctx.model.structureMode === "by_workstream";

  return {
    showWorkstream:
      td?.showWorkstreamPicker ?? (tracksManufacturer || tracksWorkstream),
    showYear:
      td?.showYearPicker ??
      (tracksManufacturer || ctx.model.structureMode === "by_year_phase"),
  };
}

export function operatingModelLabel(model: OperatingContext["model"]): string {
  return model.label;
}
