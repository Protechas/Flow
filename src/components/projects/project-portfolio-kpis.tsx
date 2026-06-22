"use client";

import { KpiStrip, type KpiItem } from "@/components/platform/kpi-strip";
import { formatForecastHours } from "@/lib/forecast/engine";
import type { PortfolioFilter, PortfolioKpis } from "@/lib/projects/portfolio-utils";

const CARD_DEFS: {
  id: "active" | "behind" | "due" | "qa" | "hours" | "open";
  label: string;
  filter: PortfolioFilter | "hours_sort";
  getValue: (k: PortfolioKpis) => string;
  warn?: (k: PortfolioKpis) => boolean;
}[] = [
  { id: "active", label: "Active Projects", filter: "all", getValue: (k) => String(k.activeProjects) },
  {
    id: "behind",
    label: "Behind Capacity",
    filter: "behind_capacity",
    getValue: (k) => String(k.behindCapacity),
    warn: (k) => k.behindCapacity > 0,
  },
  {
    id: "due",
    label: "Due This Week",
    filter: "due_soon",
    getValue: (k) => String(k.dueThisWeek),
    warn: (k) => k.dueThisWeek > 0,
  },
  {
    id: "qa",
    label: "Ready for QA",
    filter: "ready_for_qa",
    getValue: (k) => String(k.readyForQa),
    warn: (k) => k.readyForQa > 0,
  },
  {
    id: "hours",
    label: "Total Estimated Hours",
    filter: "hours_sort",
    getValue: (k) => formatForecastHours(k.totalEstimatedHours),
  },
  {
    id: "open",
    label: "Open Tasks",
    filter: "all",
    getValue: (k) => String(k.openTasks),
    warn: (k) => k.openTasks > 0,
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
  const items: KpiItem[] = CARD_DEFS.map((card) => ({
    id: card.id,
    label: card.label,
    value: card.getValue(kpis),
    warn: card.warn?.(kpis),
    onClick: () => onFilter(card.filter),
    title: `Filter: ${card.label}`,
  }));

  return <KpiStrip items={items} columns={6} />;
}
