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
  /**
   * Automatic SI-standard content checks on PDF submissions. Default ON;
   * teams whose documents don't follow the SI Library format (naming grammar,
   * landscape, highlights) turn this off so they aren't false-flagged.
   */
  contentChecksEnabled?: boolean;
  /**
   * Clock-out upload gate. When enabled, a task flagged files-required that the
   * analyst worked at least `minTimedMinutes` on today must have an upload
   * before they can clock out. The minutes threshold stops a task someone
   * merely opened (then went to a meeting or break) from trapping clock-out.
   * Default: enabled, 30-minute threshold.
   */
  uploadGate?: {
    enabled?: boolean;
    minTimedMinutes?: number;
  };
  /** Fallback model — used when no team/dept match exists. */
  isGeneral?: boolean;
}

export const DEFAULT_UPLOAD_GATE_MIN_MINUTES = 30;

export interface ResolvedUploadGate {
  enabled: boolean;
  minTimedMinutes: number;
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
