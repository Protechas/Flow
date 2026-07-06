"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { ProjectEarlyWarning } from "@/lib/forecast/project-early-warning";
import { operationsHref } from "@/lib/navigation/deep-links";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, TrendingDown } from "lucide-react";

export function ProjectEarlyWarningPanel({ warning }: { warning: ProjectEarlyWarning }) {
  if (warning.severity === "on_track" || warning.severity === "unknown") return null;

  const critical = warning.severity === "critical";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        critical
          ? "border-red-500/25 bg-red-500/5"
          : "border-amber-500/25 bg-amber-500/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {critical ? (
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          ) : (
            <TrendingDown className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Early warning
              <InfoTooltip helpKey="projectEarlyWarning" />
            </p>
            <p className={cn("text-sm font-semibold mt-0.5", critical && "text-destructive")}>
              {warning.headline}
            </p>
            {warning.projectedLandingDate && warning.targetDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Target {warning.targetDate} · Forecast lands {warning.projectedLandingDate}
                {warning.remainingDocuments > 0
                  ? ` · ${warning.remainingDocuments} docs remaining`
                  : ""}
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={critical ? "border-red-500/40 text-destructive" : ""}>
          {critical ? "Critical" : "At risk"}
        </Badge>
      </div>

      {warning.reasons.length > 0 && (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {warning.reasons.slice(0, 4).map((reason) => (
            <li key={reason} className="flex gap-2">
              <span className="text-muted-foreground/60 shrink-0">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {warning.reassignHint && (
        <Link
          href={operationsHref({ package: warning.reassignHint.taskId })}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Review reassignment for {warning.reassignHint.taskTitle}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
