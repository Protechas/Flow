"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { ProgramHealthBadge } from "@/components/projects/program-health-badge";
import { BoardTrackingBadges } from "@/components/projects/board-tracking-badges";
import { IntelligenceHealthBreakdown } from "@/components/projects/intelligence-health-breakdown";
import { ProgramIntelligenceTrendChart } from "@/components/projects/program-intelligence-trend-chart";
import {
  buildProgramIntelligence,
  capacityStatusLabel,
  type ProgramIntelligence,
} from "@/lib/projects/project-intelligence";
import { getProgramTrend } from "@/lib/projects/intelligence-snapshots";
import { useIntelligenceSnapshots } from "@/hooks/use-intelligence-snapshots";
import { operationsHref, projectHealthHref } from "@/lib/navigation/deep-links";
import type {
  ActivityEvent,
  ForecastSettings,
  Manufacturer,
  QaReview,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { ProjectNextActionBadge } from "@/components/projects/project-next-action-badge";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import { cn } from "@/lib/utils";
import { Activity, ArrowRight, Gauge } from "lucide-react";

function signalClass(tone: ProgramIntelligence["signals"][0]["tone"]) {
  switch (tone) {
    case "danger":
      return "text-red-400 bg-red-500/10 border-red-500/30";
    case "warn":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "success":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    default:
      return "text-muted-foreground bg-muted/20 border-border/50";
  }
}

export function ProgramIntelligencePanel({
  project,
  packages,
  manufacturers,
  yearItems,
  qaReviews,
  activity,
  forecastSettings,
  intelligence: provided,
  user,
  projects,
  analysts = [],
}: {
  project: ProjectWithStats;
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  forecastSettings: ForecastSettings;
  intelligence?: ProgramIntelligence;
  user?: import("@/types/flow").User;
  projects?: ProjectWithStats[];
  analysts?: import("@/types/flow").User[];
}) {
  const intel = useMemo(
    () =>
      provided ??
      buildProgramIntelligence(
        project,
        packages,
        manufacturers,
        yearItems,
        qaReviews,
        activity,
        forecastSettings
      ),
    [
      provided,
      project,
      packages,
      manufacturers,
      yearItems,
      qaReviews,
      activity,
      forecastSettings,
    ]
  );

  useIntelligenceSnapshots({ programs: [intel] });

  const programTrend = useMemo(
    () => getProgramTrend(project.id, 14),
    [project.id, intel.healthScore]
  );

  return (
    <section className="enterprise-panel p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Program Intelligence</h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">{intel.primaryInsight}</p>
        </div>
        <ProgramHealthBadge score={intel.healthScore} tier={intel.riskTier} />
        <BoardTrackingBadges project={project} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-md border border-border/50 bg-muted/10 px-3 py-2">
              <p className="text-muted-foreground">Forecast confidence</p>
              <p className="font-semibold tabular-nums mt-0.5">{intel.forecastConfidence}%</p>
            </div>
            <div className="rounded-md border border-border/50 bg-muted/10 px-3 py-2">
              <p className="text-muted-foreground">Team capacity load</p>
              <p className="font-semibold mt-0.5">{capacityStatusLabel(intel.capacityStatus)}</p>
            </div>
            <div className="rounded-md border border-border/50 bg-muted/10 px-3 py-2">
              <p className="text-muted-foreground">Next action</p>
              {user ? (
                <div className="mt-1">
                  <ProjectNextActionBadge
                    action={intel.nextAction}
                    project={project}
                    projects={projects ?? [project]}
                    manufacturers={manufacturers}
                    yearItems={yearItems}
                    analysts={analysts}
                    forecastSettings={forecastSettings}
                    user={user}
                    prefix=""
                    className="text-xs font-semibold px-0 py-0 border-0 bg-transparent hover:bg-transparent"
                  />
                </div>
              ) : (
                <p className="font-semibold mt-0.5">{intel.nextAction.label}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Capacity load (10-day window)</span>
              <span className="font-medium tabular-nums">{intel.capacityLoadPct}%</span>
            </div>
            <Progress value={intel.capacityLoadPct} className="h-2" />
          </div>

          {intel.signals.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {intel.signals.map((signal) => (
                <li
                  key={signal.id}
                  className={cn(
                    "text-[10px] font-medium rounded-sm border px-2 py-0.5",
                    signalClass(signal.tone)
                  )}
                >
                  {signal.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 rounded-md border border-border/50 bg-muted/5 p-3">
          <ProgramIntelligenceTrendChart
            data={programTrend}
            title="Program health (14 days)"
            compact
          />
          <div className="border-t border-border/40 pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Score breakdown</p>
            <IntelligenceHealthBreakdown
              factors={intel.healthBreakdown}
              healthScore={intel.healthScore}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1 border-t border-border/40">
        <Link
          href={operationsHref({ grouping: "by_program", projectId: project.id })}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          <Activity className="h-3 w-3" />
          View tasks in Operations
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={projectHealthHref({ projectId: project.id })}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          Project health detail
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
