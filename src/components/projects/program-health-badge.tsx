"use client";

import {
  riskTierClass,
  riskTierLabel,
  type ProgramRiskTier,
} from "@/lib/projects/project-intelligence";
import { cn } from "@/lib/utils";

export function ProgramHealthBadge({
  score,
  tier,
  compact = false,
  className,
}: {
  score: number;
  tier: ProgramRiskTier;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5",
        riskTierClass(tier),
        className
      )}
      title={`Health ${score} · ${riskTierLabel(tier)}`}
    >
      <span className={cn("font-semibold tabular-nums", compact ? "text-xs" : "text-sm")}>
        {score}
      </span>
      {!compact && (
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-90">
          {riskTierLabel(tier)}
        </span>
      )}
    </div>
  );
}
