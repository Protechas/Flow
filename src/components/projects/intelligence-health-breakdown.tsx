"use client";

import type { HealthScoreFactor } from "@/lib/projects/project-intelligence";
import { cn } from "@/lib/utils";

export function IntelligenceHealthBreakdown({
  factors,
  healthScore,
  className,
}: {
  factors: HealthScoreFactor[];
  healthScore: number;
  className?: string;
}) {
  const penalties = factors.filter((f) => f.impact < 0);
  const bonuses = factors.filter((f) => f.impact > 0);

  if (factors.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No score adjustments — program health is at baseline ({healthScore}).
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-muted-foreground">
        Score starts at 100, then factors below adjust to {healthScore}.
      </p>
      <ul className="space-y-1.5">
        {[...penalties, ...bonuses].map((factor) => (
          <li key={factor.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground truncate">{factor.label}</span>
            <span
              className={cn(
                "font-semibold tabular-nums shrink-0",
                factor.impact < 0 ? "text-amber-400" : "text-emerald-400"
              )}
            >
              {factor.impact > 0 ? "+" : ""}
              {factor.impact}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
