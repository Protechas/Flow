export type DepartmentHealthLevel = "excellent" | "healthy" | "at_risk" | "critical";

export interface DepartmentHealthSummary {
  departmentId: string;
  departmentName: string;
  score: number;
  level: DepartmentHealthLevel;
  activeTasks: number;
  overdueTasks: number;
  qaPassRate: number;
  wrapUpCompletionPct: number;
  factors: string[];
}

export function healthLevelFromScore(score: number): DepartmentHealthLevel {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 50) return "at_risk";
  return "critical";
}

export const HEALTH_LEVEL_LABELS: Record<DepartmentHealthLevel, string> = {
  excellent: "Excellent",
  healthy: "Healthy",
  at_risk: "At Risk",
  critical: "Critical",
};
