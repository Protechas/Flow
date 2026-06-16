"use client";

import { Progress } from "@/components/ui/progress";
import { formatLastActivity } from "@/components/operations/rollup-cells";
import { cn } from "@/lib/utils";
import type { RollupMetrics } from "@/types/flow";
import { AlertTriangle } from "lucide-react";

/** Compact metrics shown inside project/manufacturer group headers (browser mode). */
export function GroupHeaderMetrics({
  rollup,
  dueDate,
  leadName,
  className,
}: {
  rollup: RollupMetrics;
  dueDate?: string | null;
  leadName?: string | null;
  className?: string;
}) {
  const atRisk = rollup.overdueCount > 0 || rollup.stuckCount > 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5", className)}>
      <div className="flex items-center gap-2 min-w-[100px]">
        <Progress value={rollup.completedPct} className="h-1.5 w-16" />
        <span className="text-[10px] tabular-nums text-muted-foreground">{rollup.completedPct}%</span>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {rollup.hoursLogged}/{rollup.estimatedHours}h
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {rollup.fileCount} files
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        QA {rollup.qaPassRate}%
      </span>
      {dueDate && (
        <span className="text-[10px] text-muted-foreground tabular-nums">Due {dueDate}</span>
      )}
      {leadName && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{leadName}</span>
      )}
      <span className="text-[10px] text-muted-foreground">
        {formatLastActivity(rollup.lastActivityAt)}
      </span>
      {atRisk && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
          <AlertTriangle className="h-3 w-3" />
          At risk
        </span>
      )}
    </div>
  );
}
