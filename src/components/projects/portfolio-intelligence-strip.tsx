"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProgramHealthBadge } from "@/components/projects/program-health-badge";
import { PortfolioDepartmentOverlay } from "@/components/projects/portfolio-department-overlay";
import { ProgramIntelligenceTrendChart } from "@/components/projects/program-intelligence-trend-chart";
import {
  buildPortfolioIntelligence,
  buildPortfolioIntelligenceWithDepartments,
  type PortfolioIntelligenceSummary,
} from "@/lib/projects/project-intelligence";
import { getPortfolioTrend, trendDelta } from "@/lib/projects/intelligence-snapshots";
import { useIntelligenceSnapshots } from "@/hooks/use-intelligence-snapshots";
import type {
  ActivityEvent,
  Department,
  ForecastSettings,
  Manufacturer,
  QaReview,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import { operationsHref } from "@/lib/navigation/deep-links";
import { Activity, ArrowRight, BrainCircuit, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortfolioIntelligenceStrip({
  projects,
  packages,
  manufacturers,
  yearItems,
  qaReviews,
  activity,
  forecastSettings,
  departments = [],
  onSelectProject,
  onSelectDepartment,
  summary: provided,
}: {
  projects: ProjectWithStats[];
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  forecastSettings: ForecastSettings;
  departments?: Department[];
  onSelectProject?: (projectId: string) => void;
  onSelectDepartment?: (departmentId: string | null) => void;
  summary?: PortfolioIntelligenceSummary;
}) {
  const summary = useMemo(
    () =>
      provided ??
      (departments.length > 0
        ? buildPortfolioIntelligenceWithDepartments(
            projects,
            departments,
            packages,
            manufacturers,
            yearItems,
            qaReviews,
            activity,
            forecastSettings
          )
        : buildPortfolioIntelligence(
            projects,
            packages,
            manufacturers,
            yearItems,
            qaReviews,
            activity,
            forecastSettings
          )),
    [
      provided,
      departments,
      projects,
      packages,
      manufacturers,
      yearItems,
      qaReviews,
      activity,
      forecastSettings,
    ]
  );

  useIntelligenceSnapshots({ portfolio: summary });

  const portfolioTrend = useMemo(() => getPortfolioTrend(14), [summary.avgHealthScore]);
  const portfolioDelta = trendDelta(
    portfolioTrend.map((p) => ({ avgHealthScore: p.avgHealthScore }))
  );

  if (projects.filter((p) => p.status !== "archived").length === 0) return null;

  const attention = summary.attentionPrograms.filter((p) => p.riskTier !== "healthy");

  return (
    <section className="enterprise-panel p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Smart Project System</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Portfolio health scoring, capacity load, and attention routing
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <p className="text-2xl font-semibold tabular-nums">{summary.avgHealthScore}</p>
            {portfolioDelta !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
                  portfolioDelta >= 0 ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {portfolioDelta >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {portfolioDelta >= 0 ? "+" : ""}
                {portfolioDelta}
              </span>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Avg health score
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <Metric label="Healthy" value={summary.healthyCount} />
        <Metric label="Watch" value={summary.watchCount} warn={summary.watchCount > 0} />
        <Metric label="At risk" value={summary.atRiskCount} warn={summary.atRiskCount > 0} />
        <Metric label="Critical" value={summary.criticalCount} critical={summary.criticalCount > 0} />
        <Metric label="Avg capacity" value={`${summary.avgCapacityLoadPct}%`} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProgramIntelligenceTrendChart
          data={portfolioTrend}
          title="Portfolio health (14 days)"
          compact
        />
        <PortfolioDepartmentOverlay
          departments={summary.departmentBreakdown}
          onSelectDepartment={onSelectDepartment}
        />
      </div>

      {attention.length > 0 ? (
        <ul className="space-y-2">
          {attention.slice(0, 4).map((intel) => {
            const project = projects.find((p) => p.id === intel.projectId);
            if (!project) return null;
            return (
              <li
                key={intel.projectId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/projects/${intel.projectId}`}
                      className="text-sm font-medium hover:text-primary truncate"
                    >
                      {project.name}
                    </Link>
                    <ProgramHealthBadge score={intel.healthScore} tier={intel.riskTier} compact />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {intel.primaryInsight}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={operationsHref({ grouping: "by_program", projectId: intel.projectId })}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Activity className="h-3 w-3" />
                    Ops
                  </Link>
                  {onSelectProject && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      onClick={() => onSelectProject(intel.projectId)}
                    >
                      Structure
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          All active programs are in healthy range. No immediate portfolio attention required.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  warn,
  critical,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-2.5 py-2 ${
        critical
          ? "border-red-500/30 bg-red-500/5"
          : warn
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-border/50 bg-muted/10"
      }`}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums mt-0.5">{value}</dd>
    </div>
  );
}
