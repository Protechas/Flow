"use client";

import Link from "next/link";
import { ProgramHealthBadge } from "@/components/projects/program-health-badge";
import { IntelligenceHealthBreakdown } from "@/components/projects/intelligence-health-breakdown";
import { ProgramIntelligenceTrendChart } from "@/components/projects/program-intelligence-trend-chart";
import { getProgramTrend } from "@/lib/projects/intelligence-snapshots";
import { useIntelligenceSnapshots } from "@/hooks/use-intelligence-snapshots";
import { operationsHref } from "@/lib/navigation/deep-links";
import type { ProgramIntelligence } from "@/lib/projects/project-intelligence";
import { Activity, BrainCircuit } from "lucide-react";
import { useMemo } from "react";

export function ProjectHealthIntelligenceRow({
  projectId,
  projectName,
  intelligence,
}: {
  projectId: string;
  projectName: string;
  intelligence: ProgramIntelligence;
}) {
  useIntelligenceSnapshots({ programs: [intelligence] });

  const trend = useMemo(
    () => getProgramTrend(projectId, 14),
    [projectId, intelligence.healthScore]
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <BrainCircuit className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Program Intelligence
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{intelligence.primaryInsight}</p>
          </div>
        </div>
        <ProgramHealthBadge score={intelligence.healthScore} tier={intelligence.riskTier} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProgramIntelligenceTrendChart data={trend} title={`${projectName} health`} compact />
        <IntelligenceHealthBreakdown
          factors={intelligence.healthBreakdown}
          healthScore={intelligence.healthScore}
        />
      </div>

      <Link
        href={operationsHref({ grouping: "by_program", projectId })}
        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
      >
        <Activity className="h-3 w-3" />
        Open in Operations
      </Link>
    </div>
  );
}
