import type { DepartmentHealthLevel } from "@/lib/design/department-health";

export type EnterpriseSemanticVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "qa";

export const SEMANTIC_VARIANT_STYLES: Record<
  EnterpriseSemanticVariant,
  { badge: string; dot: string }
> = {
  neutral: {
    badge: "flow-status-neutral",
    dot: "bg-muted-foreground",
  },
  info: {
    badge: "flow-status-info",
    dot: "bg-info",
  },
  success: {
    badge: "flow-status-success",
    dot: "bg-success",
  },
  warning: {
    badge: "flow-status-warning",
    dot: "bg-warning",
  },
  danger: {
    badge: "flow-status-danger",
    dot: "bg-danger",
  },
  qa: {
    badge: "flow-status-qa",
    dot: "bg-qa",
  },
};

export const HEALTH_LEVEL_VARIANTS: Record<DepartmentHealthLevel, EnterpriseSemanticVariant> = {
  excellent: "success",
  healthy: "info",
  at_risk: "warning",
  critical: "danger",
};

export function workloadFlagVariant(
  flag?: "overloaded" | "underutilized"
): EnterpriseSemanticVariant {
  if (flag === "overloaded") return "warning";
  if (flag === "underutilized") return "info";
  return "neutral";
}
