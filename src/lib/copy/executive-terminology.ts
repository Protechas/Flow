/**
 * Standard executive & operations language for user-facing labels.
 * Visual/copy only — does not affect logic, routes, or data keys.
 */
import { HELP_TEXT } from "@/lib/help/help-text";

export const OPS_COPY = {
  operationsOverview: "Operations Overview",
  currentOperationsStatus: "Current Operations Status",
  workforceOverview: "Workforce Overview",
  operationsScore: "Operations Score",
  businessInsights: "Business Insights",
  availableCapacity: "Available Capacity",
  openEscalations: "Open Escalations",
  projectsAtRisk: "Projects At Risk",
  outstandingDailyReports: "Outstanding Daily Reports",
  employeesClockedIn: "Employees Clocked In",
  activeTasks: "Active Tasks",
  activeProjects: "Active Projects",
  capacityUtilization: "Capacity Utilization",
  requiresAttention: "Requires Attention",
  departmentHealth: "Department Health",
  departmentPerformance: "Department Performance",
  qaPerformance: "QA Performance",
  overdueTasks: "Overdue Tasks",
  workloadRisk: "Workload Risk",
  inProgress: "In progress",
  workPackages: "Work packages",
  capacityPlanning: "Planning & Forecasting",
  forecastCompletion: "Forecast Completion",
  expectedOutcome: "Expected Outcome",
  businessHealth: "Business Health",
  attentionRequired: "Attention required",
  operatingNormally: "Operating normally",
  criticalItemsOpen: "Critical items open",
  requestAssistance: "Request Assistance",
  workVisibilityScore: "Work Visibility Score",
  taskTrackingCompliance: "Task Tracking Compliance",
  activityGap: "Activity Gap",
  unassignedTime: "Unassigned Time",
  workDocumentation: "Work Documentation",
} as const;

export const OPS_TOOLTIPS = {
  operationsOverview: HELP_TEXT.operationsOverview,
  operationsScore: HELP_TEXT.operationsScore,
  projectsAtRisk: HELP_TEXT.projectsAtRisk,
  capacityUtilization: HELP_TEXT.capacityUtilization,
  outstandingDailyReports: HELP_TEXT.outstandingDailyReports,
  openEscalations: HELP_TEXT.openEscalations,
  availableCapacity: HELP_TEXT.availableCapacity,
  employeesClockedIn: HELP_TEXT.employeesClockedIn,
  activeTasks: HELP_TEXT.activeTasks,
  activeProjects: HELP_TEXT.activeProjects,
  overdueTasks: HELP_TEXT.overdueTasks,
  qaPerformance: HELP_TEXT.qaPerformance,
  departmentHealth: HELP_TEXT.departmentHealth,
} as const;
