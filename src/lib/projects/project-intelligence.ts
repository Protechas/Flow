import { projectRollup } from "@/lib/hierarchy/rollups";
import {
  getProjectNextAction,
  projectHasMissingEstimates,
  projectHasMissingTasks,
  projectIsAtRisk,
  projectIsDueSoon,
  projectIsForecastedLate,
  projectReadyForQa,
  type NextAction,
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import type {
  ActivityEvent,
  Department,
  ForecastSettings,
  Manufacturer,
  Project,
  QaReview,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";

export type ProgramRiskTier = "healthy" | "watch" | "at_risk" | "critical";

export type ProgramCapacityStatus = "available" | "balanced" | "loaded" | "overloaded";

export interface ProgramIntelligenceSignal {
  id: string;
  label: string;
  tone: "default" | "warn" | "danger" | "success";
}

export interface HealthScoreFactor {
  id: string;
  label: string;
  impact: number;
}

export interface ProgramIntelligence {
  projectId: string;
  healthScore: number;
  riskTier: ProgramRiskTier;
  capacityLoadPct: number;
  capacityStatus: ProgramCapacityStatus;
  forecastConfidence: number;
  signals: ProgramIntelligenceSignal[];
  primaryInsight: string;
  nextAction: NextAction;
  healthBreakdown: HealthScoreFactor[];
}

export interface DepartmentIntelligence {
  departmentId: string | null;
  departmentName: string;
  projectCount: number;
  avgHealthScore: number;
  avgCapacityLoadPct: number;
  atRiskCount: number;
  criticalCount: number;
  worstTier: ProgramRiskTier;
}

export interface PortfolioIntelligenceSummary {
  avgHealthScore: number;
  healthyCount: number;
  watchCount: number;
  atRiskCount: number;
  criticalCount: number;
  avgCapacityLoadPct: number;
  attentionPrograms: ProgramIntelligence[];
  departmentBreakdown: DepartmentIntelligence[];
}

function capacityStatusFromLoad(pct: number): ProgramCapacityStatus {
  if (pct >= 90) return "overloaded";
  if (pct >= 70) return "loaded";
  if (pct >= 40) return "balanced";
  return "available";
}

function riskTierFromScore(score: number, project: Project): ProgramRiskTier {
  if (project.project_due_date_status === "behind_capacity" || score < 45) return "critical";
  if (projectIsAtRisk(project) || score < 62) return "at_risk";
  if (score < 82) return "watch";
  return "healthy";
}

function computeCapacityLoad(
  packages: WorkPackage[],
  forecastSettings: ForecastSettings
): number {
  const open = packages.filter((p) => p.status !== "done");
  const remainingHours = open.reduce(
    (sum, p) => sum + Math.max(0, Number(p.estimated_hours ?? 8) - Number(p.actual_hours ?? 0)),
    0
  );
  const assignees = new Set(open.map((p) => p.assigned_to).filter(Boolean));
  const hoursPerDay = forecastSettings.productive_hours_per_day ?? 6.5;
  const teamWindow =
    Math.max(assignees.size, 1) * hoursPerDay * 10;
  return Math.min(100, Math.round((remainingHours / teamWindow) * 100));
}

function buildSignals(input: {
  project: ProjectWithStats;
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  rollup: ReturnType<typeof projectRollup>;
  capacityLoadPct: number;
}): ProgramIntelligenceSignal[] {
  const { project, packages, manufacturers, yearItems, rollup, capacityLoadPct } = input;
  const signals: ProgramIntelligenceSignal[] = [];

  if (project.project_due_date_status === "behind_capacity") {
    signals.push({ id: "behind_capacity", label: "Behind capacity", tone: "danger" });
  } else if (project.project_due_date_status === "at_risk") {
    signals.push({ id: "forecast_risk", label: "Forecast at risk", tone: "warn" });
  }

  if (rollup.overdueCount > 0) {
    signals.push({
      id: "overdue",
      label: `${rollup.overdueCount} overdue`,
      tone: "danger",
    });
  }

  if (rollup.stuckCount > 0) {
    signals.push({
      id: "stuck",
      label: `${rollup.stuckCount} stuck`,
      tone: "warn",
    });
  }

  if (projectReadyForQa(packages, project.id)) {
    signals.push({ id: "qa_queue", label: "QA queue", tone: "warn" });
  }

  if (projectHasMissingTasks(project.id, manufacturers, yearItems, packages)) {
    signals.push({ id: "missing_tasks", label: "Missing tasks", tone: "warn" });
  }

  if (projectHasMissingEstimates(project, packages)) {
    signals.push({ id: "missing_estimates", label: "Missing estimates", tone: "default" });
  }

  if (projectIsForecastedLate(project, packages)) {
    signals.push({ id: "forecast_late", label: "Forecasted late", tone: "warn" });
  }

  if (projectIsDueSoon(project, packages, yearItems)) {
    signals.push({ id: "due_soon", label: "Due soon", tone: "warn" });
  }

  if (capacityLoadPct >= 85) {
    signals.push({ id: "capacity", label: "Team overloaded", tone: "danger" });
  } else if (capacityLoadPct >= 65) {
    signals.push({ id: "capacity", label: "High team load", tone: "warn" });
  }

  if (rollup.completedPct >= 80 && signals.length === 0) {
    signals.push({ id: "on_track", label: "On track", tone: "success" });
  }

  return signals.slice(0, 5);
}

function buildHealthScoreFactors(input: {
  project: ProjectWithStats;
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  rollup: ReturnType<typeof projectRollup>;
  capacityLoadPct: number;
}): HealthScoreFactor[] {
  const { project, packages, manufacturers, yearItems, rollup, capacityLoadPct } = input;
  const factors: HealthScoreFactor[] = [];

  if (project.project_due_date_status === "behind_capacity") {
    factors.push({ id: "forecast", label: "Behind capacity forecast", impact: -28 });
  } else if (project.project_due_date_status === "at_risk") {
    factors.push({ id: "forecast", label: "Forecast at risk", impact: -14 });
  }

  if (rollup.overdueCount > 0) {
    factors.push({
      id: "overdue",
      label: `${rollup.overdueCount} overdue task${rollup.overdueCount === 1 ? "" : "s"}`,
      impact: -Math.min(rollup.overdueCount * 4, 20),
    });
  }

  if (rollup.stuckCount > 0) {
    factors.push({
      id: "stuck",
      label: `${rollup.stuckCount} stuck task${rollup.stuckCount === 1 ? "" : "s"}`,
      impact: -Math.min(rollup.stuckCount * 3, 12),
    });
  }

  if (rollup.correctionCount > 0) {
    factors.push({
      id: "corrections",
      label: `${rollup.correctionCount} QA correction${rollup.correctionCount === 1 ? "" : "s"}`,
      impact: -Math.min(rollup.correctionCount * 2, 10),
    });
  }

  if (projectHasMissingTasks(project.id, manufacturers, yearItems, packages)) {
    factors.push({ id: "missing_tasks", label: "Missing tasks in structure", impact: -10 });
  }

  if (projectHasMissingEstimates(project, packages)) {
    factors.push({ id: "missing_estimates", label: "Missing hour estimates", impact: -6 });
  }

  if (projectIsForecastedLate(project, packages)) {
    factors.push({ id: "forecast_late", label: "Forecasted past due date", impact: -8 });
  }

  const confidence = project.forecast_confidence ?? 0;
  if (confidence > 0 && confidence < 50) {
    factors.push({ id: "low_confidence", label: "Low forecast confidence", impact: -8 });
  }

  if (capacityLoadPct >= 90) {
    factors.push({ id: "capacity", label: "Team overloaded", impact: -12 });
  } else if (capacityLoadPct >= 75) {
    factors.push({ id: "capacity", label: "High team load", impact: -6 });
  }

  if (rollup.completedPct >= 75) {
    factors.push({ id: "progress", label: "Strong completion progress", impact: 4 });
  }

  return factors;
}

function healthScoreFromFactors(factors: HealthScoreFactor[]): number {
  const raw = 100 + factors.reduce((sum, factor) => sum + factor.impact, 0);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function computeHealthScore(input: {
  project: ProjectWithStats;
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  rollup: ReturnType<typeof projectRollup>;
  capacityLoadPct: number;
}): { score: number; breakdown: HealthScoreFactor[] } {
  const breakdown = buildHealthScoreFactors(input);
  return { score: healthScoreFromFactors(breakdown), breakdown };
}

function primaryInsight(
  signals: ProgramIntelligenceSignal[],
  nextAction: NextAction,
  healthScore: number
): string {
  const danger = signals.find((s) => s.tone === "danger");
  if (danger) return `${danger.label} — ${nextAction.label.toLowerCase()}.`;
  const warn = signals.find((s) => s.tone === "warn");
  if (warn) return `${warn.label} — consider ${nextAction.label.toLowerCase()}.`;
  if (healthScore >= 85) return "Program is healthy with stable forecast and workload.";
  return nextAction.label;
}

export function buildProgramIntelligence(
  project: ProjectWithStats,
  packages: WorkPackage[],
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  qaReviews: QaReview[],
  activity: ActivityEvent[],
  forecastSettings: ForecastSettings
): ProgramIntelligence {
  const projPackages = packages.filter((p) => p.project_id === project.id);
  const projYears = yearItems.filter((y) => y.project_id === project.id);
  const rollup = projectRollup(project, projPackages, manufacturers, qaReviews, projYears, activity);
  const capacityLoadPct = computeCapacityLoad(projPackages, forecastSettings);
  const { score: healthScore, breakdown: healthBreakdown } = computeHealthScore({
    project,
    packages,
    manufacturers,
    yearItems,
    rollup,
    capacityLoadPct,
  });
  const nextAction = getProjectNextAction(project, manufacturers, yearItems, packages);
  const signals = buildSignals({
    project,
    packages,
    manufacturers,
    yearItems,
    rollup,
    capacityLoadPct,
  });

  return {
    projectId: project.id,
    healthScore,
    riskTier: riskTierFromScore(healthScore, project),
    capacityLoadPct,
    capacityStatus: capacityStatusFromLoad(capacityLoadPct),
    forecastConfidence: project.forecast_confidence ?? rollup.completedPct,
    signals,
    primaryInsight: primaryInsight(signals, nextAction, healthScore),
    nextAction,
    healthBreakdown,
  };
}

const TIER_RANK: Record<ProgramRiskTier, number> = {
  healthy: 0,
  watch: 1,
  at_risk: 2,
  critical: 3,
};

function worstTier(a: ProgramRiskTier, b: ProgramRiskTier): ProgramRiskTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function buildDepartmentIntelligence(
  projects: ProjectWithStats[],
  departments: Department[],
  programIntel: ProgramIntelligence[]
): DepartmentIntelligence[] {
  const active = projects.filter((p) => p.status !== "archived");
  const byDept = new Map<string | null, { projects: ProjectWithStats[]; intel: ProgramIntelligence[] }>();

  for (const project of active) {
    const key = project.department_id ?? null;
    const bucket = byDept.get(key) ?? { projects: [], intel: [] };
    bucket.projects.push(project);
    const intel = programIntel.find((i) => i.projectId === project.id);
    if (intel) bucket.intel.push(intel);
    byDept.set(key, bucket);
  }

  const rows: DepartmentIntelligence[] = [];

  for (const [departmentId, bucket] of byDept) {
    const intel = bucket.intel;
    const departmentName =
      departmentId == null
        ? "Unassigned"
        : departments.find((d) => d.id === departmentId)?.name ?? "Department";

    const avgHealthScore = intel.length
      ? Math.round(intel.reduce((s, i) => s + i.healthScore, 0) / intel.length)
      : 0;
    const avgCapacityLoadPct = intel.length
      ? Math.round(intel.reduce((s, i) => s + i.capacityLoadPct, 0) / intel.length)
      : 0;
    const atRiskCount = intel.filter((i) => i.riskTier === "at_risk").length;
    const criticalCount = intel.filter((i) => i.riskTier === "critical").length;
    const worstTierValue =
      intel.reduce<ProgramRiskTier>((worst, i) => worstTier(worst, i.riskTier), "healthy") ??
      "healthy";

    rows.push({
      departmentId,
      departmentName,
      projectCount: bucket.projects.length,
      avgHealthScore,
      avgCapacityLoadPct,
      atRiskCount,
      criticalCount,
      worstTier: worstTierValue,
    });
  }

  return rows.sort((a, b) => a.avgHealthScore - b.avgHealthScore);
}

export function buildPortfolioIntelligence(
  projects: ProjectWithStats[],
  packages: WorkPackage[],
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  qaReviews: QaReview[],
  activity: ActivityEvent[],
  forecastSettings: ForecastSettings
): PortfolioIntelligenceSummary {
  const active = projects.filter((p) => p.status !== "archived");
  const intel = active.map((p) =>
    buildProgramIntelligence(
      p,
      packages,
      manufacturers,
      yearItems,
      qaReviews,
      activity,
      forecastSettings
    )
  );

  const tierCounts: Record<ProgramRiskTier, number> = {
    healthy: 0,
    watch: 0,
    at_risk: 0,
    critical: 0,
  };
  for (const item of intel) {
    tierCounts[item.riskTier]++;
  }

  const avgHealthScore = intel.length
    ? Math.round(intel.reduce((s, i) => s + i.healthScore, 0) / intel.length)
    : 0;
  const avgCapacityLoadPct = intel.length
    ? Math.round(intel.reduce((s, i) => s + i.capacityLoadPct, 0) / intel.length)
    : 0;

  const attentionPrograms = [...intel]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 5);

  const departmentBreakdown = buildDepartmentIntelligence(active, [], intel);

  return {
    avgHealthScore,
    healthyCount: tierCounts.healthy,
    watchCount: tierCounts.watch,
    atRiskCount: tierCounts.at_risk,
    criticalCount: tierCounts.critical,
    avgCapacityLoadPct,
    attentionPrograms,
    departmentBreakdown,
  };
}

export function buildPortfolioIntelligenceWithDepartments(
  projects: ProjectWithStats[],
  departments: Department[],
  packages: WorkPackage[],
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  qaReviews: QaReview[],
  activity: ActivityEvent[],
  forecastSettings: ForecastSettings
): PortfolioIntelligenceSummary {
  const summary = buildPortfolioIntelligence(
    projects,
    packages,
    manufacturers,
    yearItems,
    qaReviews,
    activity,
    forecastSettings
  );
  const active = projects.filter((p) => p.status !== "archived");
  const intel = active.map((p) =>
    buildProgramIntelligence(
      p,
      packages,
      manufacturers,
      yearItems,
      qaReviews,
      activity,
      forecastSettings
    )
  );
  return {
    ...summary,
    departmentBreakdown: buildDepartmentIntelligence(active, departments, intel),
  };
}

export function riskTierLabel(tier: ProgramRiskTier): string {
  switch (tier) {
    case "critical":
      return "Critical";
    case "at_risk":
      return "At Risk";
    case "watch":
      return "Watch";
    default:
      return "Healthy";
  }
}

export function riskTierClass(tier: ProgramRiskTier): string {
  switch (tier) {
    case "critical":
      return "text-red-400 border-red-500/40 bg-red-500/10";
    case "at_risk":
      return "text-amber-400 border-amber-500/40 bg-amber-500/10";
    case "watch":
      return "text-sky-400 border-sky-500/40 bg-sky-500/10";
    default:
      return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  }
}

export function capacityStatusLabel(status: ProgramCapacityStatus): string {
  switch (status) {
    case "overloaded":
      return "Overloaded";
    case "loaded":
      return "High load";
    case "balanced":
      return "Balanced";
    default:
      return "Available";
  }
}
