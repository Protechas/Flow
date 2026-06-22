import type { DueDateStatus } from "@/types/flow";
import type {
  DepartmentCapacityStatus,
  PlanningExpectedOutcome,
  PlanningRiskLevel,
} from "@/lib/planning/types";

export function dueStatusToRisk(status: DueDateStatus | null | undefined): PlanningRiskLevel {
  switch (status) {
    case "behind_capacity":
      return "critical";
    case "at_risk":
      return "at_risk";
    case "on_track":
      return "on_track";
    case "needs_review":
    case "no_forecast":
      return "minor_risk";
    default:
      return "on_track";
  }
}

export function dueStatusToOutcome(status: DueDateStatus | null | undefined): PlanningExpectedOutcome {
  switch (status) {
    case "behind_capacity":
      return "likely_missed";
    case "at_risk":
      return "at_risk";
    case "on_track":
      return "likely_on_time";
    case "needs_review":
      return "minor_risk";
    case "no_forecast":
      return "minor_risk";
    default:
      return "likely_on_time";
  }
}

export function capacityPctToStatus(pct: number): DepartmentCapacityStatus {
  if (pct >= 95) return "critical";
  if (pct >= 85) return "over_capacity";
  if (pct >= 70) return "near_capacity";
  return "healthy";
}

export function capacityStatusLabel(status: DepartmentCapacityStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "near_capacity":
      return "Near Capacity";
    case "over_capacity":
      return "Over Capacity";
    case "critical":
      return "Critical";
  }
}

export function outcomeLabel(outcome: PlanningExpectedOutcome): string {
  const labels: Record<PlanningExpectedOutcome, string> = {
    likely_on_time: "Likely On Time",
    likely_early: "Likely Early",
    minor_risk: "Minor Risk",
    at_risk: "At Risk",
    critical: "Critical",
    likely_late: "Likely Late",
    likely_missed: "Likely Missed Target",
  };
  return labels[outcome];
}

export function riskLabel(risk: PlanningRiskLevel): string {
  const labels: Record<PlanningRiskLevel, string> = {
    on_track: "On Track",
    minor_risk: "Minor Risk",
    at_risk: "At Risk",
    critical: "Critical",
    healthy: "Healthy",
    near_capacity: "Near Capacity",
    over_capacity: "Over Capacity",
  };
  return labels[risk];
}

export function departmentActionForStatus(
  status: DepartmentCapacityStatus,
  departmentName: string
): string {
  switch (status) {
    case "critical":
      return `${departmentName} is over capacity. Reassign work or adjust due dates within 3 business days.`;
    case "over_capacity":
      return `${departmentName} is approaching overload. Consider reassigning work within 7 days.`;
    case "near_capacity":
      return `${departmentName} is nearing capacity. Monitor assignments before adding new work.`;
    default:
      return `${departmentName} has available capacity for new assignments.`;
  }
}
