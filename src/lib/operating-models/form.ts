import { kpiConfigFromCatalog } from "@/lib/operating-models/kpi-catalog";
import type {
  OperatingModelHierarchyLabels,
  OperatingModelTrackingField,
  TeamOperatingModel,
} from "@/lib/operating-models/types";
import type { WorkStructureMode } from "@/lib/work-packages/smart-labels";

export type OperatingModelInput = {
  slug: string;
  label: string;
  description: string;
  departmentId?: string;
  teamId?: string;
  hierarchyLabels: OperatingModelHierarchyLabels;
  structureMode: WorkStructureMode;
  projectTypes: string[];
  defaultProjectType?: string;
  taskTypes: string[];
  trackingFields: OperatingModelTrackingField[];
  kpiIds: string[];
  forecastDefaultMinutes?: number;
  forecastProductiveHours?: number;
  forecastCapacityThreshold?: number;
  taskQaRequired?: boolean;
  taskFilesRequired?: boolean;
  showWorkstreamPicker?: boolean;
  showYearPicker?: boolean;
  contentChecksEnabled?: boolean;
  is_active?: boolean;
};

export const EMPTY_OPERATING_MODEL_INPUT: OperatingModelInput = {
  slug: "",
  label: "",
  description: "",
  hierarchyLabels: {
    workPackage: "Work Package",
    workPackageShort: "Package",
    workPackagePlural: "Work Packages",
    phase: "Phase",
    phaseShort: "Phase",
    phasePlural: "Phases",
    task: "Task",
    taskPlural: "Tasks",
  },
  structureMode: "custom",
  projectTypes: ["custom"],
  defaultProjectType: "custom",
  taskTypes: ["general"],
  trackingFields: ["hours", "qa", "files"],
  kpiIds: ["active_programs", "open_tasks", "avg_completion_pct", "ready_for_qa"],
  forecastDefaultMinutes: 60,
  forecastProductiveHours: 6,
  forecastCapacityThreshold: 85,
  taskQaRequired: false,
  taskFilesRequired: false,
  showWorkstreamPicker: true,
  showYearPicker: true,
  contentChecksEnabled: true,
  is_active: true,
};

export function modelToFormInput(model: TeamOperatingModel): OperatingModelInput {
  return {
    slug: model.slug,
    label: model.label,
    description: model.description,
    departmentId: model.departmentId,
    teamId: model.teamId,
    hierarchyLabels: model.hierarchyLabels,
    structureMode: model.structureMode,
    projectTypes: model.projectTypes,
    defaultProjectType: model.defaultProjectType,
    taskTypes: model.taskTypes,
    trackingFields: model.trackingFields,
    kpiIds: model.kpis.map((k) => k.id),
    forecastDefaultMinutes: model.forecastRules?.defaultMinutesPerUnit,
    forecastProductiveHours: model.forecastRules?.productiveHoursPerDay,
    forecastCapacityThreshold: model.forecastRules?.capacityThresholdPct,
    taskQaRequired: model.taskDefaults?.qaRequired,
    taskFilesRequired: model.taskDefaults?.filesRequired,
    showWorkstreamPicker: model.taskDefaults?.showWorkstreamPicker,
    showYearPicker: model.taskDefaults?.showYearPicker,
    contentChecksEnabled: model.contentChecksEnabled !== false,
    is_active: true,
  };
}

export function inputToModel(input: OperatingModelInput): TeamOperatingModel {
  return {
    slug: input.slug.trim(),
    label: input.label.trim(),
    description: input.description.trim(),
    departmentId: input.departmentId || undefined,
    teamId: input.teamId || undefined,
    hierarchyLabels: input.hierarchyLabels,
    structureMode: input.structureMode,
    projectTypes: input.projectTypes,
    defaultProjectType: input.defaultProjectType,
    taskTypes: input.taskTypes,
    trackingFields: input.trackingFields,
    kpis: input.kpiIds.map((id) => kpiConfigFromCatalog(id)),
    forecastRules: {
      defaultMinutesPerUnit: input.forecastDefaultMinutes,
      productiveHoursPerDay: input.forecastProductiveHours,
      capacityThresholdPct: input.forecastCapacityThreshold,
      dueDateMethod: "forecast",
    },
    taskDefaults: {
      qaRequired: input.taskQaRequired,
      filesRequired: input.taskFilesRequired,
      showWorkstreamPicker: input.showWorkstreamPicker,
      showYearPicker: input.showYearPicker,
    },
    contentChecksEnabled: input.contentChecksEnabled !== false,
  };
}
