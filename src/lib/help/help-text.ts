/**
 * Centralized plain-English explanations for contextual info tooltips.
 * If no entry exists for a key, do not render an info icon.
 */
export const HELP_TEXT = {
  // ——— Executive & operations KPIs ———
  operationsOverview:
    "Summary of workforce, delivery, and department performance from live production data.",
  operationsScore:
    "Combined team performance score based on completions, quality, on-time delivery, and activity.",
  projectsAtRisk:
    "Projects that may miss their target date based on current progress and forecast.",
  capacityUtilization:
    "Shows how much of the team's available work capacity is currently assigned.",
  outstandingDailyReports:
    "Hourly employees who clocked in today but have not submitted their required end-of-day report.",
  openEscalations:
    "Employees who have requested management assistance on active work.",
  availableCapacity:
    "Team members with low assigned workload who can take on additional tasks.",
  employeesClockedIn: "Employees currently punched in and on the clock.",
  activeTasks: "Work packages currently assigned or in progress.",
  activeProjects: "Projects with active delivery work underway.",
  overdueTasks: "Assigned work that has passed its due date.",
  qaPerformance: "Quality assurance pass rate and how many items are waiting for review.",
  departmentHealth:
    "Overall health of each department based on overdue work, QA results, and daily reports.",
  workloadRisk: "Tasks or projects flagged as behind schedule or over capacity.",
  requiresAttention: "Signals that may need manager action today.",

  // ——— Forecast & planning ———
  forecastCompletion:
    "Share of active projects forecasted to finish on or before their target date.",
  forecastCompletionRate:
    "Percentage of tracked work forecasted to complete on time across the portfolio.",
  onTimeProjects: "Projects currently forecasted to finish by their committed due date.",
  lateProjects: "Projects forecasted to finish after their target due date.",
  expectedBacklogHours: "Estimated hours of work still open across active assignments.",
  expectedDeliveriesThisWeek: "Tasks forecasted to reach QA or completion this week.",
  expectedQaVolume: "Tasks expected to enter the QA queue soon based on current pace.",
  forecastConfidence:
    "How reliable the forecast is, based on estimate quality and recent delivery history.",
  expectedOutcome:
    "Likely delivery result for a task or project based on pace, capacity, and due dates.",
  departmentCapacity: "How full a department is relative to available team capacity.",
  whatIfSimulator:
    "Preview the impact of adding work before you create it. Nothing is saved until you confirm.",

  // ——— Work visibility ———
  workVisibilityScore:
    "Overall score for how well shift time, tasks, daily reports, and work documentation align.",
  taskTrackingCompliance:
    "Shows how much clocked time is connected to recorded task activity.",
  dailyReportCompliance:
    "Share of required employees who submitted their end-of-day report on time.",
  workloadCoverage: "How well assigned work fills available team capacity.",
  capacityVisibility: "How clearly managers can see who has room for more work.",
  workDocumentation: "How consistently non-task work is documented during the shift.",
  activityGaps:
    "Periods of clocked time without a matching task timer or documented activity.",
  unassignedTime: "Shift time that is not linked to a task or documented activity category.",
  employeesWithGaps: "Employees with open activity or tracking gaps today.",

  // ——— Project health ———
  overallProgress: "Percent of work packages completed across this project.",
  hoursLogged: "Total hours recorded against tasks in this project.",
  estimatedRemaining: "Forecast hours still needed to finish open work.",
  qaIssues: "Open quality issues or items returned from QA on this project.",
  blockedStuck: "Tasks marked stuck or blocked from progressing.",
  projectOverdue: "Tasks in this project that are past their due date.",
  customProjectMetrics:
    "Project-specific measures defined by your team or template (targets, KPIs, outcomes).",

  // ——— Daily reports / wrap-ups ———
  wrapUpCompliance:
    "Tracks whether hourly employees submitted their required end-of-day report before clock-out.",
  wrapUpSubmitted: "Employees who submitted today's end-of-day report.",
  wrapUpMissing: "Employees who clocked in and worked today but still owe their end-of-day report.",
  wrapUpOverridden: "Reports marked complete by a manager without employee submission.",
  wrapUpBlockedAttempts:
    "Times an employee tried to clock out without submitting their daily report.",
  wrapUpReview: "Manager review queue for submitted daily reports.",
  wrapUpUnreviewed: "Submitted daily reports waiting for manager review.",
  wrapUpFollowUp: "Daily reports flagged as needing follow-up from a manager.",

  // ——— Time clock ———
  teamMembers: "Production employees in your reporting scope on the time clock page.",
  teamAvailability:
    "Live view of who is on shift, on lunch, on task, or off shift.",
  clockedIn: "Employees currently punched in for their shift.",
  onLunch: "Employees punched out for lunch who are expected to return.",
  onTaskSalary: "Salary employees actively working on a timed task.",
  offShift: "Employees not currently punched in for a shift.",
  teamTimeToday: "Combined shift and task time recorded today for the team.",
  timeClockRecords: "Shift punch history for the selected period.",

  // ——— Org chart & alerts ———
  workloadNeedsWork:
    "This person may run out of assigned work soon and need new tasks.",
  workloadHealthy: "Assigned workload is in a healthy range for this employee.",
  helpFlagActive: "This person has requested assistance from a manager.",
  missingWrapUpFlag: "This person has not submitted today's required daily report.",
  workloadAlert:
    "System flag that an employee may need more work or is running low on assignments.",
  helpFlag: "Employee request for manager support on current work.",

  // ——— QA ———
  qaQueue: "Tasks waiting for quality review before they can be marked complete.",
  qaPassRate: "Percentage of QA reviews passed without correction.",

  // ——— Files ———
  fileCategory:
    "Groups company documents so employees can find SOPs, training, and reference material.",
  fileCategorySop: "Standard operating procedures and how-to guides for production work.",
  fileCategoryTraining: "Training materials and onboarding documents.",
  fileCategoryPolicy: "Company policies employees must follow.",
  fileCategoryReference: "Reference documents used during daily work.",
  fileCategoryOther: "General company documents that do not fit another category.",

  // ——— User & org fields ———
  departmentField: "Primary department this person belongs to for reporting and scoping.",
  teamField: "Team assignment used for work routing and manager visibility.",
  supervisorField: "Manager or lead this person reports to in the org chart.",
  orgSeatField: "Position slot on the org chart this person occupies.",
  orgChartPosition:
    "Role level on the org chart (employee, team lead, manager). Controls hierarchy visibility.",
  systemAccessLevel:
    "Platform admin access separate from day-to-day job role (standard, admin, super admin).",
  payType:
    "Whether the employee uses the shift clock (hourly) or task time only (salary).",
  branchViewAccess:
    "Allows a manager to see their full branch in the org chart, not only direct reports.",

  // ——— Forecast intelligence ———
  projectEarlyWarning:
    "Compares remaining work, calibrated velocity, and assignee queue depth against the project target date.",

  // ——— Library Intelligence & Audit Engine ———
  libraryScore:
    "Percent of expected deliverables passing compliance across each manufacturer's latest audit.",
  manufacturersAudited: "Manufacturers with at least one completed library audit.",
  libraryExpectedDeliverables:
    "Total documents the manufacturer charts say the library should contain.",
  libraryPassing: "Deliverables present in the library and passing compliance checks.",
  libraryNeedsReview:
    "Deliverables flagged for a human look — naming differences, split files, or unclear matches.",
  libraryTrueMissing:
    "Deliverables the audit could not find in the library at all. The highest-priority gap.",
  libraryPcsReview:
    "Files that likely exist but under a different name or classification — usually a rename, not a re-download.",
  libraryJourney:
    "Compares each manufacturer's first-ever audit against its latest. The gap shows how far the library has come since the baseline.",
  smartInsights: "Auto-generated observations from the latest audit results.",

  // ——— ROI ———
  roiLaborSaved:
    "Counted automated events × the manual hours each one replaces × the labor rate. Assumptions are editable.",
  roiHoursSaved: "Production hours the team did not have to spend on manual work.",
  roiSubscription:
    "Active Flow accounts × what a seat on the replaced project tool would cost per month.",
  roiLaborRate: "Average hourly wage used to price saved hours. Editable in assumptions.",
  roiWorkflowLines:
    "Everyday events Flow recorded — tracked days, reports, corrections, submissions — each priced at the minutes it saved.",
  roiEngineLines:
    "Completed audit and validation runs, each priced at the hours the same check takes by hand.",
  estimatedSavings:
    "Completed automated runs × the manual hours each replaces × the labor rate. Adjust assumptions to match real timings.",

  // ——— Employee scoring & morale ———
  todaysScore: "Your production numbers for today. They reset each workday.",
  flowScore:
    "0–100 score from four parts: productivity 40%, quality 30%, on-time 20%, activity 10%. Tap the ring for the full breakdown.",
  effectiveDocuments:
    "Documents counted fairly: a file split into parts counts as one document, and exact duplicate re-uploads count once.",
  taskTimerTotal:
    "Time on this task never resets. Stop and pause both save your session — the smaller number is time since your last submission, the larger is your all-time total on this task.",
  badgesPanel:
    "Earned automatically from real work — uploads, QA passes, streaks, clean clock days. Badges unlock avatar frames, titles, and accent colors under Customize.",
  coachPanel:
    "Short nudges based on your current work state. Use the Attitude dropdown to pick how your coach talks to you.",
  leaderboardRanking:
    "Ranked by Flow Score; badge count breaks ties. Scores come from effective documents, QA results, and on-time delivery — not raw hours.",
  employeeEvaluation:
    "System-captured signals (clock corrections, missed reports, QA returns) plus manager-logged incidents, in one place.",

  // ——— QA Engine & ID³ ———
  qaEngineFindings:
    "Issues the QA Engine found in the uploaded workbooks. Filter, expand for expected vs found, then mark Reviewed, Dismissed, or Ready for task.",
  id3Compare:
    "Compares a manufacturer chart against the saved rules row by row — mismatches, missing entries, and rows no rule covers.",
} as const;

export type HelpTextKey = keyof typeof HELP_TEXT;

export function getHelpText(key: HelpTextKey): string {
  return HELP_TEXT[key];
}

/** Optional doc links — only keys with a working in-app help page. */
export const HELP_LEARN_MORE: Partial<Record<HelpTextKey, string>> = {
  outstandingDailyReports: "/docs/employee-guide",
  wrapUpCompliance: "/docs/employee-guide",
  taskTrackingCompliance: "/docs/operations-manual",
  workVisibilityScore: "/docs/operations-manual",
  activeProjects: "/docs/creating-work",
  activeTasks: "/docs/creating-work",
};

export function getHelpLearnMoreHref(key: HelpTextKey): string | undefined {
  return HELP_LEARN_MORE[key];
}

/** Planning snapshot metric id → help key */
export const PLANNING_METRIC_HELP_KEYS: Record<string, HelpTextKey> = {
  active_projects: "activeProjects",
  active_tasks: "activeTasks",
  projects_at_risk: "projectsAtRisk",
  clocked_in: "employeesClockedIn",
  awaiting_assignment: "availableCapacity",
  help_flags: "openEscalations",
  wrap_ups: "outstandingDailyReports",
  qa_queue: "qaQueue",
  capacity: "capacityUtilization",
  workload_risk: "workloadRisk",
  work_visibility: "workVisibilityScore",
  activity_gaps: "activityGaps",
  dept_health: "departmentHealth",
};

/** Work visibility score breakdown chip label → help key */
export const WORK_VISIBILITY_CHIP_HELP: Record<string, HelpTextKey> = {
  "Task tracking": "taskTrackingCompliance",
  "Daily reports": "dailyReportCompliance",
  "Workload coverage": "workloadCoverage",
  "Capacity visibility": "capacityVisibility",
  "Work documentation": "workDocumentation",
  "Activity gaps": "activityGaps",
};

/** Planning center forecast KPI label → help key */
export const FORECAST_KPI_HELP: Record<string, HelpTextKey> = {
  "On-Time Projects": "onTimeProjects",
  "Late Projects": "lateProjects",
  "Forecast Completion Rate": "forecastCompletionRate",
  "Capacity Utilization": "capacityUtilization",
  "Expected Backlog (hrs)": "expectedBacklogHours",
  "Deliveries This Week": "expectedDeliveriesThisWeek",
  "Expected QA Volume": "expectedQaVolume",
  "Forecast Confidence": "forecastConfidence",
  "Employees With Gaps": "employeesWithGaps",
};

/** Company document category value → help key */
export const FILE_CATEGORY_HELP: Record<string, HelpTextKey> = {
  sop: "fileCategorySop",
  policy: "fileCategoryPolicy",
  reference: "fileCategoryReference",
  other: "fileCategoryOther",
};

/** Project health stat label → help key */
export const PROJECT_HEALTH_STAT_HELP: Record<string, HelpTextKey> = {
  "Hours Logged": "hoursLogged",
  "Est. Remaining": "estimatedRemaining",
  "QA Issues": "qaIssues",
  "Blocked/Stuck": "blockedStuck",
  Overdue: "projectOverdue",
  Overall: "overallProgress",
};
