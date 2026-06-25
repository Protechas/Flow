import {
  getHierarchyLabels as getSmartHierarchyLabels,
  type SmartHierarchyLabels,
} from "@/lib/work-packages/smart-labels";

/** Default labels when project context is unknown — backend types unchanged. */
const DEFAULT = getSmartHierarchyLabels();

/** @deprecated Prefer getHierarchyLabels(projectType) for project-aware labels. */
export const HIERARCHY_LABELS = {
  workstream: DEFAULT.workPackage,
  workstreamShort: DEFAULT.workPackageShort,
  workstreamPlural: DEFAULT.workPackagePlural,
  manufacturer: DEFAULT.workPackage,
  manufacturerPlural: DEFAULT.workPackagePlural,
  phase: DEFAULT.phase,
  phaseShort: DEFAULT.phaseShort,
  phasePlural: DEFAULT.phasePlural,
  year: DEFAULT.phase,
  yearPlural: DEFAULT.phasePlural,
  task: DEFAULT.task,
  taskPlural: DEFAULT.taskPlural,
} as const;

export function getHierarchyLabels(
  projectType?: string | null,
  structureMode?: import("@/lib/work-packages/smart-labels").WorkStructureMode | null
): SmartHierarchyLabels {
  return getSmartHierarchyLabels(projectType, structureMode);
}

/** Labels for a persisted program — prefers structure_mode when set. */
export function getProjectHierarchyLabels(project: {
  project_type?: string | null;
  structure_mode?: string | null;
}): SmartHierarchyLabels {
  return getHierarchyLabels(
    project.project_type,
    (project.structure_mode as import("@/lib/work-packages/smart-labels").WorkStructureMode | null) ??
      null
  );
}

/** Labels when you have type + mode but not a full project record. */
export function getProgramLabels(
  projectType?: string | null,
  structureMode?: string | null
): SmartHierarchyLabels {
  return getHierarchyLabels(
    projectType,
    (structureMode as import("@/lib/work-packages/smart-labels").WorkStructureMode | null) ?? null
  );
}

export const RISK_LABELS: Record<string, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind_capacity: "Critical",
  needs_review: "Monitor",
  no_forecast: "No Forecast",
};

export function businessRiskLabel(status: string | null | undefined): string {
  if (!status) return "No Forecast";
  return RISK_LABELS[status] ?? status.replace(/_/g, " ");
}
