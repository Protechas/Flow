import type { WorkStructureMode } from "@/lib/work-packages/smart-labels";

export type OperatingModelKpiType =
  | "count"
  | "percentage"
  | "hours"
  | "currency"
  | "boolean"
  | "status"
  | "formula"
  | "manual";

export type OperatingModelKpiSource =
  | "portfolio"
  | "intelligence"
  | "manual"
  | "custom_metric";

export type OperatingModelTrackingField =
  | "documents"
  | "records"
  | "hours"
  | "files"
  | "qa"
  | "corrections"
  | "accuracy"
  | "features"
  | "bugs"
  | "deployments"
  | "custom_metric";

export type OperatingModelDisplayLocation =
  | "team_dashboard"
  | "manager"
  | "executive"
  | "report";

export interface OperatingModelHierarchyLabels {
  workPackage: string;
  workPackageShort?: string;
  workPackagePlural?: string;
  phase: string;
  phaseShort?: string;
  phasePlural?: string;
  task?: string;
  taskPlural?: string;
}

export interface OperatingModelKpiConfig {
  id: string;
  name: string;
  description?: string;
  type: OperatingModelKpiType;
  source?: OperatingModelKpiSource;
  portfolioKey?: string;
  target?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  warnWhen?: "high" | "low";
  displayLocations?: OperatingModelDisplayLocation[];
}

export interface OperatingModelTaskDefaults {
  qaRequired?: boolean;
  filesRequired?: boolean;
  estimateType?: "minutes" | "hours" | "points";
  showWorkstreamPicker?: boolean;
  showYearPicker?: boolean;
}

export interface OperatingModelForecastRules {
  defaultMinutesPerUnit?: number;
  productiveHoursPerDay?: number;
  complexityMultipliers?: Record<string, number>;
  capacityThresholdPct?: number;
  dueDateMethod?: "forecast" | "calendar" | "manual";
}

export interface TeamOperatingModel {
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
  kpis: OperatingModelKpiConfig[];
  forecastRules?: OperatingModelForecastRules;
  taskDefaults?: OperatingModelTaskDefaults;
  /** Fallback model — used when no team/dept match exists. */
  isGeneral?: boolean;
}

export interface TeamOperatingModelRecord extends TeamOperatingModel {
  id?: string;
  is_active?: boolean;
  sort_order?: number;
  updated_at?: string;
  updated_by?: string | null;
}

export interface OperatingContext {
  model: TeamOperatingModel;
  departmentId?: string;
  teamId?: string;
}
