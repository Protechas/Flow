"use client";

import { useMemo } from "react";
import type { ProgramTrendPoint, PortfolioTrendPoint } from "@/lib/projects/intelligence-snapshots";
import { trendDelta } from "@/lib/projects/intelligence-snapshots";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = ProgramTrendPoint | PortfolioTrendPoint;

function scoreKey(point: TrendPoint): number {
  return "healthScore" in point ? point.healthScore : point.avgHealthScore;
}

export function ProgramIntelligenceTrendChart({
  data,
  title = "Health trend",
  compact = false,
  className,
}: {
  data: TrendPoint[];
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  const chartData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        score: scoreKey(point),
      })),
    [data]
  );

  const delta = trendDelta(
    data.map((p) =>
      "healthScore" in p ? { healthScore: p.healthScore } : { avgHealthScore: p.avgHealthScore }
    )
  );

  if (data.length === 0) {
    return (
      <div className={cn("rounded-md border border-dashed border-border/60 px-3 py-4 text-center", className)}>
        <p className="text-xs text-muted-foreground">
          Trend builds as you visit — one snapshot recorded per day.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {delta !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium tabular-nums",
              delta >= 0 ? "text-emerald-400" : "text-amber-400"
            )}
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}
            {delta} pts
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 11,
            }}
            formatter={(value) => [`${value ?? 0}`, "Health"]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--chart-2)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
