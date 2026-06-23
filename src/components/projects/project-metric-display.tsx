"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ProjectMetricView } from "@/types/flow";

function trendLabel(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || delta === 0) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} (7d)`;
}

export function ProjectMetricDisplay({ metric }: { metric: ProjectMetricView }) {
  const trend = trendLabel(metric.trend_7d);
  const pct =
    metric.metric_type === "percentage" && metric.numeric_value !== null
      ? metric.numeric_value
      : metric.target_value && metric.numeric_value !== null
        ? Math.min(100, Math.round((metric.numeric_value / metric.target_value) * 100))
        : null;

  if (metric.display_style === "progress_bar" || metric.display_style === "target_vs_actual") {
    return (
      <div className="enterprise-panel px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="enterprise-label">{metric.metric_name}</p>
            <p className="flow-metric-md mt-1">{metric.resolved_value}</p>
          </div>
          {trend && (
            <span
              className={cn(
                "text-[10px] font-medium",
                (metric.trend_7d ?? 0) >= 0 ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {trend}
            </span>
          )}
        </div>
        {pct !== null && <Progress value={pct} className="h-1.5" />}
        {metric.metric_description && (
          <p className="text-[11px] text-muted-foreground">{metric.metric_description}</p>
        )}
      </div>
    );
  }

  if (metric.display_style === "percentage_ring") {
    return (
      <div className="enterprise-panel px-4 py-3 text-center">
        <p className="enterprise-label">{metric.metric_name}</p>
        <p className="flow-metric-lg mt-1">{metric.resolved_value}</p>
        {metric.target_value != null && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Target {metric.target_value}%</p>
        )}
      </div>
    );
  }

  if (metric.display_style === "status_badge") {
    return (
      <div className="enterprise-panel px-4 py-3">
        <p className="enterprise-label">{metric.metric_name}</p>
        <p className="text-sm font-medium mt-1 capitalize">{metric.resolved_value}</p>
      </div>
    );
  }

  if (metric.display_style === "kpi_tile") {
    return (
      <div className="enterprise-panel px-4 py-3">
        <p className="enterprise-label">{metric.metric_name}</p>
        <p className="flow-metric-lg mt-1">{metric.resolved_value}</p>
      </div>
    );
  }

  return (
    <div className="enterprise-panel px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="enterprise-label">{metric.metric_name}</p>
          <p className="flow-metric-md mt-1">{metric.resolved_value}</p>
        </div>
        {trend && (
          <span className="text-[10px] text-muted-foreground">{trend}</span>
        )}
      </div>
      {metric.target_value != null && metric.numeric_value !== null && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Target {metric.target_value}
        </p>
      )}
    </div>
  );
}
