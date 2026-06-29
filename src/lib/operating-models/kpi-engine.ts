import type { OperatingModelKpiConfig } from "@/lib/operating-models/types";
import type { PortfolioKpis } from "@/lib/projects/portfolio-utils";

export interface OperatingModelKpiValue {
  id: string;
  name: string;
  value: string;
  subtitle?: string;
  warn?: boolean;
}

function formatValue(type: OperatingModelKpiConfig["type"], raw: number): string {
  if (type === "percentage") return `${Math.round(raw)}%`;
  if (type === "hours") return `${Math.round(raw)}h`;
  return String(Math.round(raw));
}

function rawFromPortfolio(
  key: string | undefined,
  portfolio: PortfolioKpis,
  avgHealth: number,
  avgCapacity: number,
  avgCompletion: number
): number | null {
  switch (key) {
    case "activeProjects":
      return portfolio.activeProjects;
    case "openTasks":
      return portfolio.openTasks;
    case "projectsAtRisk":
      return portfolio.projectsAtRisk;
    case "forecastedLate":
      return portfolio.forecastedLate;
    case "readyForQa":
      return portfolio.readyForQa;
    case "avgHealthScore":
      return avgHealth;
    case "avgCapacityLoad":
      return avgCapacity;
    case "avgCompletionPct":
      return avgCompletion;
    default:
      return null;
  }
}

function isWarning(kpi: OperatingModelKpiConfig, raw: number): boolean {
  if (kpi.warnWhen === "high" && kpi.warningThreshold != null) return raw >= kpi.warningThreshold;
  if (kpi.warnWhen === "low" && kpi.warningThreshold != null) return raw <= kpi.warningThreshold;
  if (kpi.warnWhen === "high") return raw > 0;
  if (kpi.warnWhen === "low") return raw < 70;
  return false;
}

export function resolveOperatingModelKpiValues(
  kpis: OperatingModelKpiConfig[],
  portfolio: PortfolioKpis,
  avgHealth: number,
  avgCapacity: number,
  avgCompletion: number
): OperatingModelKpiValue[] {
  return kpis
    .filter((k) => k.displayLocations?.includes("team_dashboard") !== false)
    .map((kpi) => {
      if (kpi.source === "manual" || kpi.source === "custom_metric") {
        return {
          id: kpi.id,
          name: kpi.name,
          value: "—",
          subtitle: "Track on projects or enter manually",
        };
      }

      const raw = rawFromPortfolio(
        kpi.portfolioKey,
        portfolio,
        avgHealth,
        avgCapacity,
        avgCompletion
      );

      if (raw == null) {
        return {
          id: kpi.id,
          name: kpi.name,
          value: "—",
          subtitle: kpi.description,
        };
      }

      return {
        id: kpi.id,
        name: kpi.name,
        value: formatValue(kpi.type, raw),
        subtitle: kpi.description,
        warn: isWarning(kpi, raw),
      };
    });
}
