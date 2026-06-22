/**
 * Standard executive & operations language for user-facing labels.
 * Visual/copy only — does not affect logic, routes, or data keys.
 */
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
  operationsOverview:
    "Summary of company-wide operational metrics updated from live production data.",
  operationsScore:
    "Combined operational performance score based on workload, QA, reporting compliance, and project health.",
  projectsAtRisk:
    "Projects currently projected to miss their target completion date.",
  capacityUtilization:
    "Percentage of available workforce capacity currently being used.",
  outstandingDailyReports:
    "Employees who have not submitted their required end-of-day report.",
  openEscalations:
    "Employees who have requested management assistance on active work.",
  availableCapacity:
    "Team members with low assigned workload who can take on additional tasks.",
  employeesClockedIn: "Employees currently punched in and on the clock.",
  activeTasks: "Work packages currently assigned or in progress.",
  activeProjects: "Projects with active delivery work underway.",
  overdueTasks: "Assigned work that has passed its due date.",
  qaPerformance: "Quality assurance pass rate and review queue volume.",
  departmentHealth: "Composite health score across workload, QA, and delivery for each department.",
} as const;
