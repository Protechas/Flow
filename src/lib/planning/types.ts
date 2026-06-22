import type { DueDateStatus, ForecastComplexityLevel } from "@/types/flow";

export type PlanningRiskLevel =
  | "on_track"
  | "minor_risk"
  | "at_risk"
  | "critical"
  | "healthy"
  | "near_capacity"
  | "over_capacity";

export type PlanningExpectedOutcome =
  | "likely_on_time"
  | "likely_early"
  | "minor_risk"
  | "at_risk"
  | "critical"
  | "likely_late"
  | "likely_missed";

export type DepartmentCapacityStatus =
  | "healthy"
  | "near_capacity"
  | "over_capacity"
  | "critical";

export type DelayImpactLevel = "none" | "minor" | "moderate" | "severe";

export interface PlanningMetricLink {
  id: string;
  label: string;
  value: string | number;
  href: string;
  warn?: boolean;
  critical?: boolean;
  sublabel?: string;
}

export interface ExecutiveForecastSummary {
  projectsForecastedOnTime: number;
  projectsForecastedLate: number;
  forecastCompletionRate: number;
  capacityUtilizationPct: number;
  expectedBacklogHours: number;
  expectedDeliveriesThisWeek: number;
  expectedQaVolume: number;
  expectedComplianceRate: number;
  operationalRiskLevel: PlanningRiskLevel;
  forecastConfidence: number;
}

export interface ExpectedOutcomesSummary {
  projectCompletionsThisWeek: number;
  projectCompletionsThisMonth: number;
  projectsLikelyOnTime: number;
  projectsLikelyLate: number;
  expectedAvailableCapacityHours: number;
  expectedBacklogGrowthHours: number;
  expectedBacklogReductionHours: number;
  expectedQaWorkload: number;
  expectedComplianceRate: number;
}

export interface DepartmentForecastRow {
  departmentId: string;
  departmentName: string;
  currentCapacityPct: number;
  forecastCapacityPct: number;
  assignedHours: number;
  remainingHours: number;
  availableHours: number;
  projectsAtRisk: number;
  forecastCompletionDate: string | null;
  capacityIn7DaysPct: number;
  capacityIn30DaysPct: number;
  capacityIn60DaysPct: number;
  status: DepartmentCapacityStatus;
  recommendedAction: string;
}

export interface ProjectForecastRow {
  projectId: string;
  projectName: string;
  currentStatus: string;
  forecastStatus: DueDateStatus | null;
  progressPct: number;
  forecastCompletionDate: string | null;
  forecastConfidence: number;
  remainingHours: number;
  remainingDocuments: number;
  workloadTrend: "increasing" | "stable" | "decreasing";
  riskLevel: PlanningRiskLevel;
  expectedOutcome: PlanningExpectedOutcome;
}

export interface TaskForecastRow {
  taskId: string;
  taskTitle: string;
  projectName: string;
  assigneeName: string | null;
  currentStatus: string;
  progressPct: number;
  documentsCompleted: number;
  documentsRemaining: number;
  estimatedRemainingHours: number;
  forecastCompletionDate: string | null;
  forecastConfidence: number;
  expectedOutcome: PlanningExpectedOutcome;
  riskLevel: PlanningRiskLevel;
}

export interface PlanningRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  reasoning: string;
  href?: string;
  category:
    | "assignment"
    | "capacity"
    | "forecast"
    | "qa"
    | "compliance"
    | "department"
    | "project"
    | "visibility";
}

export interface PlanningWorkVisibilitySummary {
  score: number;
  taskTrackingCompliancePct: number;
  openActivityGaps: number;
  employeesWithGaps: number;
}

export interface PlanningCenterSnapshot {
  scopeLabel: string;
  operationsStatus: PlanningMetricLink[];
  executiveForecast: ExecutiveForecastSummary;
  expectedOutcomes: ExpectedOutcomesSummary;
  departmentForecasts: DepartmentForecastRow[];
  projectForecasts: ProjectForecastRow[];
  taskForecasts: TaskForecastRow[];
  workVisibility: PlanningWorkVisibilitySummary;
  recommendations: PlanningRecommendation[];
}

export interface TaskImpactDraft {
  title: string;
  estimated_document_count: number | null;
  complexity_level: ForecastComplexityLevel;
  manual_due_date?: string | null;
  assigned_to?: string | null;
  department_id?: string | null;
  project_id?: string | null;
  priority?: string;
}

export interface AssigneeRecommendation {
  userId: string;
  name: string;
  score: number;
  remainingHours: number | null;
  reasoning: string;
  isPrimary: boolean;
}

export interface TaskImpactPreview {
  taskForecast: {
    estimatedHours: number;
    estimatedWorkDays: number;
    suggestedDueDate: string | null;
    dueDateStatus: DueDateStatus;
    forecastConfidence: number;
  };
  departmentDelay: {
    level: DelayImpactLevel;
    explanation: string;
    addedHours: number;
    businessDaysDelayed: number;
  };
  projectDelay: {
    currentForecastDate: string | null;
    newForecastDate: string | null;
    daysAdded: number;
    riskChange: string;
    applies: boolean;
  };
  capacity: {
    currentPct: number;
    afterPct: number;
    changePct: number;
    status: DepartmentCapacityStatus;
  };
  riskLevel: PlanningRiskLevel;
  expectedOutcome: PlanningExpectedOutcome;
  recommendedAssignees: AssigneeRecommendation[];
}

export interface WhatIfInput {
  documentCount: number;
  complexity: ForecastComplexityLevel;
  priority?: string;
  manualDueDate?: string | null;
  departmentId?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
}

export interface WhatIfResult {
  taskHours: number;
  taskDays: number;
  suggestedDue: string | null;
  departmentCapacityAfterPct: number;
  projectDaysAdded: number;
  riskLevel: PlanningRiskLevel;
  expectedOutcome: PlanningExpectedOutcome;
}
