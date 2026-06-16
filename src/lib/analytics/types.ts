import type { DepartmentHealthSummary } from "@/lib/design/department-health";
import type { FlowScoreTrendPoint, ForecastReportMetrics } from "@/types/flow";

export interface AnalyticsEmployeeSpeed {
  userId: string;
  name: string;
  docsPerHour: number;
  avgMinutesPerDocument: number;
  submissions: number;
  fileCount: number;
  flowScore: number;
  rank: number;
}

export interface AnalyticsWorkloadEmployee {
  userId: string;
  name: string;
  active: number;
  inProgress: number;
  overdue: number;
  stuck: number;
  hours: number;
  flag?: "overloaded" | "underutilized" | "needs_work";
}

export interface AnalyticsTeamQa {
  teamId: string;
  teamName: string;
  departmentName: string;
  passRate: number;
  reviewCount: number;
  corrections: number;
}

export interface AnalyticsProjectRisk {
  projectId: string;
  name: string;
  completedPct: number;
  overdue: number;
  qaRate: number;
  status: "at_risk" | "on_track" | "near_completion";
  behindForecast: boolean;
}

export interface AnalyticsManagerInsight {
  userId: string;
  name: string;
  category: "coaching" | "support" | "recognition";
  reason: string;
  flowScore: number;
  priority: number;
}

export interface FlowAnalyticsSnapshot {
  generatedAt: string;
  periodDays: number;
  scopeLabel: string;

  headline: {
    fastestEmployee: AnalyticsEmployeeSpeed | null;
    mostOverloaded: AnalyticsWorkloadEmployee | null;
    mostUnderutilized: AnalyticsWorkloadEmployee | null;
    employeesNeedingWork: number;
    strugglingDepartment: DepartmentHealthSummary | null;
    projectsBehind: number;
    orgAvgMinutesPerDocument: number;
    topQaTeam: AnalyticsTeamQa | null;
  };

  employee: {
    speedRankings: AnalyticsEmployeeSpeed[];
    workload: AnalyticsWorkloadEmployee[];
    overloaded: AnalyticsWorkloadEmployee[];
    underutilized: AnalyticsWorkloadEmployee[];
    needsWork: AnalyticsWorkloadEmployee[];
    flowScoreLeaders: { userId: string; name: string; flowScore: number; trendDelta: number }[];
  };

  department: {
    health: DepartmentHealthSummary[];
    production: {
      departmentId: string;
      name: string;
      submissions: number;
      fileCount: number;
      hoursWorked: number;
      avgMinutesPerDocument: number;
    }[];
    struggling: DepartmentHealthSummary[];
  };

  manager: {
    teamFlowScore: number;
    avgQaPassRate: number;
    avgOnTimeRate: number;
    insights: AnalyticsManagerInsight[];
    topPerformers: { userId: string; name: string; flowScore: number }[];
    needsAttention: { userId: string; name: string; reason: string; flowScore: number }[];
  };

  forecast: ForecastReportMetrics & {
    projectsFallingBehind: AnalyticsProjectRisk[];
  };

  qa: {
    orgPassRate: number;
    correctionsToday: number;
    correctionsWeek: number;
    byTeam: AnalyticsTeamQa[];
    byDepartment: { departmentId: string; departmentName: string; passRate: number; reviewCount: number }[];
    lowPerformers: { userId: string; name: string; passRate: number; corrections: number }[];
  };

  capacity: {
    clockedIn: number;
    activeTaskTimers: number;
    capacityUtilizationPct: number;
    avgActiveWorkPerEmployee: number;
    documentsCompletedToday: number;
    departmentLoad: { departmentId: string; departmentName: string; activeTasks: number; estimatedHours: number }[];
    unusedCapacityHours: number;
  };

  workload: {
    openAlerts: number;
    criticalAlerts: number;
    noWorkCount: number;
    lowWorkloadCount: number;
    openHelpFlags: number;
    criticalHelpFlags: number;
    wrapUpMissing: number;
    wrapUpSubmitted: number;
    byDepartmentAlerts: { departmentId: string; departmentName: string; alertCount: number; criticalCount: number }[];
  };

  trends: {
    production: { date: string; avgMinutesPerDocument: number; submissions: number; avgDocsPerHour: number }[];
    flowScore: FlowScoreTrendPoint[];
    minutesPerDocumentTrend: { date: string; value: number }[];
  };
}
