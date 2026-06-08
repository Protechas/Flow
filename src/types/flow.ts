export type UserRole = "admin" | "manager" | "qa" | "employee" | "viewer";

export type WorkStatus =
  | "not_started"
  | "assigned"
  | "working_on_it"
  | "waiting"
  | "ready_for_qa"
  | "in_qa"
  | "correction_needed"
  | "stuck"
  | "done";

export type WorkPriority = "low" | "medium" | "high" | "urgent";

export type QaStatus =
  | "pending"
  | "passed"
  | "minor_correction"
  | "major_correction"
  | "rejected";

export type QaResult =
  | "pass"
  | "minor_correction"
  | "major_correction"
  | "rejected";

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  manager_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditAction =
  | "user_created"
  | "user_invited"
  | "user_disabled"
  | "user_reactivated"
  | "role_changed"
  | "team_changed"
  | "assignment_changed"
  | "project_changed"
  | "qa_decision"
  | "password_reset"
  | "status_changed"
  | "workflow_alert";

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  team_id?: string | null;
  manager_id?: string | null;
  avatar_url?: string | null;
  hire_date?: string | null;
  last_login_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  project_type: string;
  team_id?: string | null;
  status: string;
  priority: WorkPriority;
  start_date?: string | null;
  due_date?: string | null;
  end_date?: string | null;
  project_owner_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Manufacturer {
  id: string;
  project_id: string;
  name: string;
  code?: string | null;
  assigned_to?: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  due_date?: string | null;
  notes?: string | null;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

/** Year row: Project → Manufacturer → Year Work Item → Work Packages */
export interface YearWorkItem {
  id: string;
  project_id: string;
  manufacturer_id: string;
  year: number;
  assigned_to?: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  due_date?: string | null;
  estimated_hours: number;
  actual_hours: number;
  file_count: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkPackage {
  id: string;
  project_id: string;
  manufacturer_id: string;
  year_work_item_id: string;
  year: number;
  title: string;
  notes?: string | null;
  description?: string | null;
  assigned_to?: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  due_date?: string | null;
  start_date?: string | null;
  completed_date?: string | null;
  estimated_hours: number;
  actual_hours: number;
  file_count: number;
  qa_status: QaStatus;
  correction_count: number;
  created_at: string;
  updated_at: string;
  project?: Project;
  manufacturer?: Manufacturer;
  assignee?: User;
}

/** @deprecated Use WorkPackage */
export type WorkItem = WorkPackage;

export interface TimeLog {
  id: string;
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
  notes?: string | null;
  created_at: string;
}

export interface QaReview {
  id: string;
  work_package_id: string;
  reviewer_id: string;
  analyst_id: string;
  result: QaResult;
  error_category?: string | null;
  notes?: string | null;
  attachments?: string[];
  reviewed_at: string;
  created_at: string;
  work_package?: WorkPackage;
  reviewer?: User;
  analyst?: User;
}

export interface Correction {
  id: string;
  work_package_id: string;
  qa_review_id?: string | null;
  assigned_to: string;
  description: string;
  resolved: boolean;
  resolved_at?: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  work_package_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface FlowFile {
  id: string;
  work_package_id?: string | null;
  project_id?: string | null;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  created_at: string;
}

export type ActivityEventType =
  | "status_change"
  | "assignment"
  | "time_log"
  | "qa_review"
  | "comment"
  | "file_upload"
  | "submit_qa"
  | "task_complete"
  | "correction_received"
  | "correction_resolved";

export interface ActivityEvent {
  id: string;
  user_id: string;
  work_package_id?: string | null;
  type: ActivityEventType;
  summary: string;
  created_at: string;
}

export type NotificationType =
  | "new_assignment"
  | "task_due_soon"
  | "task_overdue"
  | "qa_review_needed"
  | "qa_passed"
  | "correction_issued"
  | "correction_resolved"
  | "comment_mention"
  | "file_uploaded"
  | "project_at_risk"
  | "employee_overloaded"
  | "work_stuck";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string;
  related_entity_id: string;
  read_status: boolean;
  link?: string | null;
  created_at: string;
}

export interface ActionContribution {
  type: ActivityEventType;
  label: string;
  count: number;
  points: number;
}

export interface FlowScoreTrendPoint {
  date: string;
  label: string;
  flowScore: number;
  productivityScore: number;
  qualityScore: number;
  activityPoints: number;
  completions: number;
  hoursLogged: number;
}

/** Core employee scorecard KPIs */
export interface ScorecardMetrics {
  packagesCompleted: number;
  packagesCompletedMonth: number;
  packagesCompletedQuarter: number;
  hoursLogged: number;
  hoursLoggedMonth: number;
  hoursLoggedQuarter: number;
  avgCompletionTimeHours: number;
  qaPassRate: number;
  correctionsReceived: number;
  correctionsResolved: number;
  openCorrections: number;
  overdueWork: number;
  activeWork: number;
}

export interface ScorecardPeriodTrendPoint {
  period: string;
  label: string;
  packagesCompleted: number;
  hoursLogged: number;
  avgCompletionTimeHours: number;
  qaPassRate: number;
  correctionsReceived: number;
  correctionsResolved: number;
  overdueWork: number;
  activeWork: number;
}

export interface TeamScorecardSummary {
  employeeCount: number;
  averages: ScorecardMetrics;
  totals: Pick<
    ScorecardMetrics,
    | "packagesCompleted"
    | "hoursLogged"
    | "correctionsReceived"
    | "correctionsResolved"
    | "overdueWork"
    | "activeWork"
  >;
}

export interface AccountabilityFlag {
  severity: "critical" | "warning" | "info";
  code: string;
  message: string;
  metric?: number;
}

export interface CoachingInsight {
  priority: "high" | "medium" | "low";
  category: "quality" | "productivity" | "engagement" | "timeliness" | "workflow";
  title: string;
  recommendation: string;
  metric?: string;
  type?: "strength" | "weakness" | "opportunity";
}

/** Transparent factor in a Flow Score component */
export interface ScoreFactor {
  id: string;
  label: string;
  rawValue: number | string;
  normalizedScore: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface ComponentScore {
  score: number;
  weight: number;
  factors: ScoreFactor[];
}

export interface FlowScoreBreakdown {
  flowScore: number;
  formula: string;
  productivity: ComponentScore;
  quality: ComponentScore;
  onTime: ComponentScore;
  activity: ComponentScore;
  calculatedAt: string;
}

export interface FlowBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedReason?: string;
}

export interface FlowAchievement {
  id: string;
  title: string;
  description: string;
  earnedAt?: string;
  progress?: number;
  target?: number;
}

export interface EmployeeScorecard extends PeopleProfile {
  rank: number;
  totalRanked: number;
  managerName: string | null;
  scoreBreakdown: FlowScoreBreakdown;
  trend30: FlowScoreTrendPoint[];
  trend90: FlowScoreTrendPoint[];
  badges: FlowBadge[];
  achievements: FlowAchievement[];
  metrics: ScorecardMetrics;
  monthlyTrends: ScorecardPeriodTrendPoint[];
  quarterlyTrends: ScorecardPeriodTrendPoint[];
  actionPoints: number;
  actionPointsToday: number;
  actionBreakdown: ActionContribution[];
  trend: FlowScoreTrendPoint[];
  accountabilityFlags: AccountabilityFlag[];
  coachingInsights: CoachingInsight[];
  velocityPerWeek: number;
  engagementLevel: "high" | "medium" | "low";
  submissionsToQa: number;
  tasksCompleted: number;
}

export interface EmployeeRanking {
  rank: number;
  userId: string;
  name: string;
  flowScore: number;
  actionPoints: number;
  completedThisWeek: number;
  qaPassRate: number;
  trendDelta: number;
}

export interface AccountabilityEntry {
  userId: string;
  name: string;
  flags: AccountabilityFlag[];
  flowScore: number;
  overdueItems: number;
  stuckItems: number;
  openCorrections: number;
  daysSinceLastActivity: number | null;
}

export interface AccountabilityReport {
  generatedAt: string;
  criticalCount: number;
  warningCount: number;
  entries: AccountabilityEntry[];
}

export interface CoachingReportEntry {
  userId: string;
  name: string;
  flowScore: number;
  rank: number;
  insights: CoachingInsight[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  focusAreas: string[];
}

export interface CoachingReport {
  generatedAt: string;
  teamAverageScore: number;
  entries: CoachingReportEntry[];
}

export interface AccountabilityDashboard {
  departmentAvgFlowScore: number;
  teamProductivity: number;
  teamQaRate: number;
  topPerformers: EmployeeRanking[];
  mostImproved: EmployeeRanking[];
  mostConsistent: EmployeeRanking[];
  needsAttention: { userId: string; name: string; reason: string; flowScore: number }[];
  highestCorrectionRate: { userId: string; name: string; rate: number; count: number }[];
  mostOverdue: { userId: string; name: string; count: number }[];
  workloadDistribution: { userId: string; name: string; active: number; hours: number; flowScore: number }[];
  rankings: EmployeeRanking[];
  trends30: FlowScoreTrendPoint[];
}

export interface TeamPerformanceDashboard {
  teamFlowScore: number;
  teamActionPoints: number;
  avgQaPassRate: number;
  avgOnTimeRate: number;
  rankings: EmployeeRanking[];
  trends: FlowScoreTrendPoint[];
  accountability: AccountabilityReport;
  accountabilityDashboard: AccountabilityDashboard;
  coaching: CoachingReport;
  topPerformers: EmployeeRanking[];
  needsAttention: { userId: string; name: string; reason: string; flowScore: number }[];
  leaderboard: EmployeeRanking[];
}

export interface RollupMetrics {
  totalPackages: number;
  completedPackages: number;
  completedPct: number;
  hoursLogged: number;
  estimatedHours: number;
  fileCount: number;
  qaPassRate: number;
  correctionCount: number;
  overdueCount: number;
  stuckCount: number;
  readyForQa: number;
  lastActivityAt: string | null;
}

export interface ProjectRollup extends RollupMetrics {
  projectId: string;
  projectName: string;
  manufacturerCount: number;
  yearCount: number;
}

export interface ManufacturerRollup extends RollupMetrics {
  manufacturerId: string;
  manufacturerName: string;
  projectId: string;
  yearCount: number;
  completedYears: number;
}

export interface YearRollup extends RollupMetrics {
  yearWorkItemId: string;
  year: number;
  manufacturerId: string;
  projectId: string;
  packages: WorkPackage[];
}

export interface OperationsTree {
  projects: ProjectTreeNode[];
}

export interface ProjectTreeNode {
  project: Project;
  rollup: ProjectRollup;
  manufacturers: ManufacturerTreeNode[];
}

export interface ManufacturerTreeNode {
  manufacturer: Manufacturer;
  rollup: ManufacturerRollup;
  years: YearTreeNode[];
}

export interface YearTreeNode {
  yearWorkItem: YearWorkItem;
  rollup: YearRollup;
  packages: WorkPackage[];
}

export interface ExecutiveMetrics {
  teamFlowScore: number;
  teamProductivity: number;
  teamQaRate: number;
  activePackages: number;
  overduePackages: number;
  stuckPackages: number;
  readyForQa: number;
  completedToday: number;
  completedThisWeek: number;
  hoursLoggedToday: number;
  qaPassRate: number;
  projectHealth: { name: string; completedPct: number; overdue: number; stuck: number }[];
  topPerformer: { userId: string; name: string; flowScore: number } | null;
  mostImproved: { userId: string; name: string; trendDelta: number; flowScore: number } | null;
  mostAtRisk: { userId: string; name: string; reason: string; flowScore: number } | null;
  topPerformers: { userId: string; name: string; flowScore: number }[];
  needsAttention: { userId: string; name: string; reason: string }[];
  workloadByAnalyst: { name: string; active: number; hours: number }[];
  departmentTrends: FlowScoreTrendPoint[];
}

export interface MetricExplanation {
  title: string;
  value: string | number;
  formula: string;
  source: string;
  drilldownHref?: string;
  factors?: { label: string; value: string | number }[];
}

export interface CommandCenterInsight {
  id: string;
  priority: "high" | "medium" | "low";
  text: string;
  metric: string;
  category: "productivity" | "quality" | "workload" | "qa" | "project";
  drilldownHref?: string;
}

export interface CommandCenterMetrics {
  teamHealth: {
    flowScore: number;
    productivityScore: number;
    qualityScore: number;
    onTimeScore: number;
    topPerformer: { userId: string; name: string; flowScore: number } | null;
    mostImproved: { userId: string; name: string; trendDelta: number; flowScore: number } | null;
    needsAttention: { userId: string; name: string; reason: string; flowScore: number } | null;
    mostOverloaded: { userId: string; name: string; active: number; hours: number } | null;
    lowestUtilization: { userId: string; name: string; active: number; hours: number } | null;
    scoreExplanations: {
      flow: MetricExplanation;
      productivity: MetricExplanation;
      quality: MetricExplanation;
      onTime: MetricExplanation;
    };
  };
  workload: {
    active: number;
    inProgress: number;
    readyForQa: number;
    correctionNeeded: number;
    overdue: number;
    stuck: number;
    avgActivePerEmployee: number;
    byEmployee: {
      userId: string;
      name: string;
      active: number;
      inProgress: number;
      overdue: number;
      stuck: number;
      hours: number;
      flag?: "overloaded" | "underutilized";
    }[];
  };
  projectHealth: {
    active: number;
    atRisk: number;
    onTrack: number;
    nearCompletion: number;
    projects: {
      id: string;
      name: string;
      completedPct: number;
      hoursLogged: number;
      qaRate: number;
      overdue: number;
      estimatedCompletion: string | null;
      status: "at_risk" | "on_track" | "near_completion";
    }[];
  };
  qaHealth: {
    queueSize: number;
    avgTurnaroundHours: number;
    passRate: number;
    correctionsToday: number;
    correctionsThisWeek: number;
    bottlenecks: { label: string; count: number; href: string }[];
    highCorrectionAnalysts: { userId: string; name: string; rate: number; count: number }[];
  };
  accountability: {
    overdueEmployees: { userId: string; name: string; count: number }[];
    stuckEmployees: { userId: string; name: string; count: number }[];
    decliningScores: { userId: string; name: string; trendDelta: number; flowScore: number }[];
    repeatedQaFailures: { userId: string; name: string; corrections: number; qaPassRate: number }[];
    attentionList: {
      userId: string;
      name: string;
      category: "coaching" | "support" | "recognition";
      reason: string;
      priority: number;
      flowScore: number;
    }[];
  };
  insights: CommandCenterInsight[];
  trends30: FlowScoreTrendPoint[];
}

export interface DailyWrapUp {
  id: string;
  user_id: string;
  wrap_date: string;
  completed_summary: string | null;
  blockers: string | null;
  needs_support: boolean;
  needs_support_note: string | null;
  created_at: string;
}

export interface EmployeeQaReturn {
  package: WorkPackage;
  review: QaReview;
  reviewerName: string;
  correctionType: string;
  reason: string;
}

export interface EmployeeDailySummary {
  tasksCompletedToday: number;
  hoursWorkedToday: number;
  qaPasses: number;
  correctionsReceived: number;
}

export type EmployeeQueueSort = "priority" | "due_date" | "assigned_date";

export interface PeopleProfile {
  user: User;
  currentWork: WorkPackage[];
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  hoursLogged: number;
  avgHoursPerPackage: number;
  qaPassRate: number;
  corrections: number;
  onTimeRate: number;
  overdueItems: number;
  stuckItems: number;
  flowScore: number;
  productivityScore: number;
  qualityScore: number;
  onTimeScore: number;
  activityScore: number;
  recentActivity: ActivityEvent[];
  recentQaFeedback: QaReview[];
}

export interface ProjectHealth {
  project: Project;
  overallProgress: number;
  manufacturerProgress: { name: string; completedPct: number; packages: number }[];
  hoursLogged: number;
  estimatedRemaining: number;
  qaIssues: number;
  blockedCount: number;
  overdueCount: number;
  assignedAnalysts: string[];
  projectedCompletion?: string | null;
  rollup: ProjectRollup;
}

export interface ReportMetrics {
  productivityByAnalyst: { name: string; completed: number; hours: number }[];
  qaPassRate: number;
  totalCorrections: number;
  avgTimePerPackage: number;
  overdueCount: number;
  stuckCount: number;
  completedByPeriod: { period: string; count: number }[];
  workloadByAnalyst: { name: string; active: number; hours: number }[];
  efficiencyByProject: { name: string; completed: number; avgHours: number }[];
  efficiencyByManufacturer: { name: string; completed: number; avgHours: number }[];
  performanceTrends: { date: string; flowScore: number }[];
  hierarchySummary: { projects: number; manufacturers: number; years: number; packages: number };
}

export type ProjectInput = Pick<
  Project,
  | "name"
  | "description"
  | "project_type"
  | "status"
  | "priority"
  | "start_date"
  | "due_date"
  | "project_owner_id"
>;

export type ManufacturerInput = Pick<
  Manufacturer,
  "project_id" | "name" | "assigned_to" | "status" | "priority" | "due_date" | "notes"
>;

export type YearWorkItemInput = Pick<
  YearWorkItem,
  | "manufacturer_id"
  | "project_id"
  | "year"
  | "assigned_to"
  | "status"
  | "priority"
  | "due_date"
  | "estimated_hours"
  | "notes"
>;

export type WorkPackageInput = Pick<
  WorkPackage,
  | "project_id"
  | "manufacturer_id"
  | "year_work_item_id"
  | "year"
  | "title"
  | "notes"
  | "description"
  | "assigned_to"
  | "status"
  | "priority"
  | "due_date"
  | "start_date"
  | "estimated_hours"
>;

export type WorkItemInput = WorkPackageInput;
