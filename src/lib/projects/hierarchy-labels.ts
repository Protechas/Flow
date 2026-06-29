import {
  getHierarchyLabels as getSmartHierarchyLabels,
  type SmartHierarchyLabels,
} from "@/lib/work-packages/smart-labels";
import { operatingModelToHierarchyLabels } from "@/lib/operating-models/context";
import { resolveOperatingModelForProject } from "@/lib/operating-models/resolve";
import type { Project, Team } from "@/types/flow";

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
  structureMode?: import("@/lib/work-packages/smart-labels").WorkStructureMode | null,
  operatingModelLabels?: Partial<SmartHierarchyLabels> | null
): SmartHierarchyLabels {
  return getSmartHierarchyLabels(projectType, structureMode, operatingModelLabels);
}

/** Labels for a persisted program — prefers operating model, then structure_mode / project_type. */
export function getProjectHierarchyLabels(
  project: {
    project_type?: string | null;
    structure_mode?: string | null;
    team_id?: string | null;
    department_id?: string | null;
  },
  teams: Team[] = []
): SmartHierarchyLabels {
  const model = resolveOperatingModelForProject(project, teams);
  const modelLabels = operatingModelToHierarchyLabels(model);
  return getHierarchyLabels(
    project.project_type,
    (project.structure_mode as import("@/lib/work-packages/smart-labels").WorkStructureMode | null) ??
      model.structureMode ??
      null,
    modelLabels
  );
}

/** Labels when you have type + mode but not a full project record. */
export function getProgramLabels(
  projectType?: string | null,
  structureMode?: string | null,
  operatingModelLabels?: Partial<SmartHierarchyLabels> | null
): SmartHierarchyLabels {
  return getHierarchyLabels(
    projectType,
    (structureMode as import("@/lib/work-packages/smart-labels").WorkStructureMode | null) ?? null,
    operatingModelLabels
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
