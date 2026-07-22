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
  /** Default counting unit for the team's new projects (files, lines, records…). */
  defaultUnit?: string;
}

/**
 * Extra prompt shown on a team's daily wrap-up form. Answers land in
 * daily_wrap_ups.sections keyed by `id`, so teams can extend the wrap-up
 * without schema changes (e.g. Advanced Projects' "Next planned action").
 */
export interface OperatingModelWrapUpField {
  id: string;
  label: string;
  placeholder?: string;
}

/**
 * Weekly manager update ("Friday section"). When enabled, the team's manager
 * gets a structured weekly form — prompts from `fields` — submittable on
 * Fridays; leadership reads submissions in the Daily Report Review area.
 */
export interface OperatingModelManagerUpdateConfig {
  enabled?: boolean;
  fields: OperatingModelWrapUpField[];
}

/**
 * Employee weekly updates. When enabled, each team member gets a weekly
 * update draft (auto-compiled from their daily wrap-ups and completed
 * tasks) with the team's sections, submittable inside the configured
 * window. `opens`/`due` are day-of-week (0=Sun…6=Sat) + hour (0–23) in the
 * organization timezone — e.g. AP: opens Thu 17:00, due Fri 15:00.
 */
export interface OperatingModelWeeklyUpdatesConfig {
  enabled?: boolean;
  fields: OperatingModelWrapUpField[];
  opens: { day: number; hour: number };
  due: { day: number; hour: number };
}

/** Per-team employee-workspace behavior — how the home page renders. */
export interface OperatingModelWorkspaceConfig {
  /** Show an "Active projects" panel built from the employee's open tasks. */
  showActiveProjectsPanel?: boolean;
  /** Sort overdue tasks to the top of the Up Next queue. */
  overdueFirst?: boolean;
  /** Notify the employee's manager when submitted records are revised. */
  notifyManagerOnEdits?: boolean;
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
  /**
   * When true, this team's employees never appear in cross-employee rankings
   * (leaderboards, accountability/coaching queues, dashboard rank lists).
   * They keep their own stats, scorecard, and time-clock function — project
   * work just isn't comparable head-to-head (e.g. Advanced Projects).
   */
  excludeFromRankings?: boolean;
  /** Extra team-specific wrap-up prompts appended to the daily wrap-up form. */
  wrapUpFields?: OperatingModelWrapUpField[];
  /** Per-team employee-workspace rendering (home panels, queue ordering). */
  workspace?: OperatingModelWorkspaceConfig;
  /** Weekly manager update form ("Friday section"). */
  managerUpdate?: OperatingModelManagerUpdateConfig;
  /** Employee weekly updates (auto-drafted, window-gated). */
  weeklyUpdates?: OperatingModelWeeklyUpdatesConfig;
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
