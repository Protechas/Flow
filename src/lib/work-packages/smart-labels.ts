/** User-facing labels — backend still uses manufacturer / year_work_item / work_package. */

export type WorkStructureMode =
  | "by_manufacturer"
  | "by_year_phase"
  | "by_workstream"
  | "by_team"
  | "simple_task_list"
  | "custom";

export interface SmartHierarchyLabels {
  workPackage: string;
  workPackageShort: string;
  workPackagePlural: string;
  phase: string;
  phaseShort: string;
  phasePlural: string;
  task: string;
  taskPlural: string;
}

const DEFAULT_LABELS: SmartHierarchyLabels = {
  workPackage: "Work Package",
  workPackageShort: "Package",
  workPackagePlural: "Work Packages",
  phase: "Phase",
  phaseShort: "Phase",
  phasePlural: "Phases",
  task: "Task",
  taskPlural: "Tasks",
};

const PROJECT_TYPE_LABELS: Record<string, Partial<SmartHierarchyLabels>> = {
  si_corrections: {
    workPackage: "Manufacturer",
    workPackageShort: "Manufacturer",
    workPackagePlural: "Manufacturers",
    phase: "Year",
    phaseShort: "Year",
    phasePlural: "Years",
  },
  special_functions: {
    workPackage: "Manufacturer",
    workPackageShort: "Manufacturer",
    workPackagePlural: "Manufacturers",
    phase: "Year",
    phaseShort: "Year",
    phasePlural: "Years",
  },
  adas: {
    workPackage: "Workstream",
    workPackageShort: "Workstream",
    workPackagePlural: "Workstreams",
    phase: "Milestone",
    phaseShort: "Milestone",
    phasePlural: "Milestones",
  },
  research: {
    workPackage: "Work Package",
    workPackageShort: "Package",
    workPackagePlural: "Work Packages",
    phase: "Phase",
    phaseShort: "Phase",
    phasePlural: "Phases",
  },
  custom: DEFAULT_LABELS,
  board: {
    workPackage: "Work Package",
    workPackageShort: "Package",
    workPackagePlural: "Work Packages",
    phase: "Stage",
    phaseShort: "Stage",
    phasePlural: "Stages",
  },
  training: {
    workPackage: "Training Module",
    workPackageShort: "Module",
    workPackagePlural: "Training Modules",
    phase: "Training Phase",
    phaseShort: "Phase",
    phasePlural: "Training Phases",
  },
  id3_validation: {
    workPackage: "Dataset",
    workPackageShort: "Dataset",
    workPackagePlural: "Datasets",
    phase: "Validation Batch",
    phaseShort: "Batch",
    phasePlural: "Validation Batches",
  },
};

const STRUCTURE_MODE_LABELS: Record<WorkStructureMode, Partial<SmartHierarchyLabels>> = {
  by_manufacturer: {
    workPackage: "Manufacturer",
    workPackageShort: "Manufacturer",
    workPackagePlural: "Manufacturers",
    phase: "Year",
    phaseShort: "Year",
    phasePlural: "Years",
  },
  by_year_phase: {
    workPackage: "Year",
    workPackageShort: "Year",
    workPackagePlural: "Years",
    phase: "Phase",
    phaseShort: "Phase",
    phasePlural: "Phases",
  },
  by_workstream: {
    workPackage: "Workstream",
    workPackageShort: "Workstream",
    workPackagePlural: "Workstreams",
    phase: "Milestone",
    phaseShort: "Milestone",
    phasePlural: "Milestones",
  },
  by_team: {
    workPackage: "Team",
    workPackageShort: "Team",
    workPackagePlural: "Teams",
    phase: "Phase",
    phaseShort: "Phase",
    phasePlural: "Phases",
  },
  simple_task_list: DEFAULT_LABELS,
  custom: DEFAULT_LABELS,
};

export const WORK_STRUCTURE_OPTIONS: {
  value: WorkStructureMode;
  label: string;
  description: string;
}[] = [
  {
    value: "by_manufacturer",
    label: "By Manufacturer",
    description: "OEM or brand buckets with model years underneath",
  },
  {
    value: "by_year_phase",
    label: "By Year / Phase",
    description: "Time-based buckets with phases for each period",
  },
  {
    value: "by_workstream",
    label: "By Workstream",
    description: "Feature or program streams with milestones",
  },
  {
    value: "by_team",
    label: "By Team",
    description: "Organize work by owning team",
  },
  {
    value: "simple_task_list",
    label: "Simple Task List",
    description: "One general package — add tasks directly",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Name packages and phases however you need",
  },
];

function mergeLabels(
  ...layers: Array<Partial<SmartHierarchyLabels> | undefined>
): SmartHierarchyLabels {
  return { ...DEFAULT_LABELS, ...layers.reduce((acc, l) => ({ ...acc, ...l }), {}) };
}

export function getHierarchyLabels(
  projectType?: string | null,
  structureMode?: WorkStructureMode | null,
  operatingModelLabels?: Partial<SmartHierarchyLabels> | null
): SmartHierarchyLabels {
  const typeLayer = projectType ? PROJECT_TYPE_LABELS[projectType] : undefined;
  const modeLayer = structureMode ? STRUCTURE_MODE_LABELS[structureMode] : undefined;
  return mergeLabels(typeLayer, modeLayer, operatingModelLabels ?? undefined);
}

export function defaultStructureModeForProjectType(
  projectType: string
): WorkStructureMode {
  switch (projectType) {
    case "si_corrections":
    case "special_functions":
      return "by_manufacturer";
    case "adas":
      return "by_workstream";
    case "board":
      return "simple_task_list";
    default:
      return "custom";
  }
}

export function projectTypeFromTemplateId(templateId: string): string {
  switch (templateId) {
    case "si_corrections":
      return "si_corrections";
    case "adas_2026":
      return "adas";
    case "sf_phase_1":
      return "special_functions";
    case "research":
      return "research";
    default:
      return "custom";
  }
}
