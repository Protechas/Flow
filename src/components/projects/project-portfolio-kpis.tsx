"use client";

import { KpiStrip, type KpiItem } from "@/components/platform/kpi-strip";
import { kpiFilterForCard, type PortfolioFilter, type PortfolioKpis } from "@/lib/projects/portfolio-utils";

const CARD_DEFS: {
  id: "active" | "at_risk" | "due" | "qa" | "open" | "late";
  label: string;
  getValue: (k: PortfolioKpis) => string;
  warn?: (k: PortfolioKpis) => boolean;
  critical?: (k: PortfolioKpis) => boolean;
}[] = [
  { id: "active", label: "Active Projects", getValue: (k) => String(k.activeProjects) },
  {
    id: "at_risk",
    label: "Projects At Risk",
    getValue: (k) => String(k.projectsAtRisk),
    warn: (k) => k.projectsAtRisk > 0,
    critical: (k) => k.behindCapacity > 0,
  },
  {
    id: "due",
    label: "Due This Week",
    getValue: (k) => String(k.dueThisWeek),
    warn: (k) => k.dueThisWeek > 0,
  },
  {
    id: "qa",
    label: "Ready For QA",
    getValue: (k) => String(k.readyForQa),
    warn: (k) => k.readyForQa > 0,
  },
  {
    id: "open",
    label: "Open Tasks",
    getValue: (k) => String(k.openTasks),
    warn: (k) => k.openTasks > 0,
  },
  {
    id: "late",
    label: "Forecasted Late",
    getValue: (k) => String(k.forecastedLate),
    warn: (k) => k.forecastedLate > 0,
    critical: (k) => k.forecastedLate > 0,
  },
];

export function ProjectPortfolioKpis({
  kpis,
  activeFilter,
  onFilter,
}: {
  kpis: PortfolioKpis;
  activeFilter: PortfolioFilter | "hours_sort";
  onFilter: (filter: PortfolioFilter | "hours_sort") => void;
}) {
  const items: KpiItem[] = CARD_DEFS.map((card) => {
    const filter = kpiFilterForCard(card.id);
    const isActive = activeFilter === filter;
    return {
      id: card.id,
      label: card.label,
      value: card.getValue(kpis),
      warn: card.warn?.(kpis),
      critical: card.critical?.(kpis),
      onClick: () => onFilter(filter),
      title: `Filter: ${card.label}`,
      className: isActive ? "ring-1 ring-primary/50 bg-primary/5" : undefined,
    };
  });

  return <KpiStrip items={items} columns={6} />;
}
