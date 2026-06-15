"use client";

import { useMemo, useState } from "react";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { cn } from "@/lib/utils";
import type { FlowScoreTrendPoint } from "@/types/flow";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SeriesKey = "flowScore" | "productivityScore" | "qualityScore";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "flowScore", label: "Flow Score", color: "var(--chart-1)" },
  { key: "productivityScore", label: "Productivity", color: "var(--chart-3)" },
  { key: "qualityScore", label: "Quality", color: "var(--chart-2)" },
];

export function PerformanceTrendChart({
  data,
  title = "Flow Score trend",
  description,
}: {
  data: FlowScoreTrendPoint[];
  title?: string;
  description?: string;
}) {
  const [active, setActive] = useState<SeriesKey>("flowScore");
  const series = SERIES.find((s) => s.key === active)!;

  const trendDelta = useMemo(() => {
    if (data.length < 2) return null;
    return data[data.length - 1].flowScore - data[0].flowScore;
  }, [data]);

  return (
    <EnterpriseSection
      title={title}
      description={
        description ??
        (trendDelta !== null
          ? `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(0)} vs period start`
          : undefined)
      }
    >
      <div className="enterprise-panel p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs font-medium transition-colors",
                active === s.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={{ r: 2, fill: series.color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </EnterpriseSection>
  );
}
