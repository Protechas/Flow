"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScorecardPeriodTrendPoint } from "@/types/flow";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const METRIC_OPTIONS = [
  { key: "packagesCompleted", label: "Packages", color: "hsl(262 83% 58%)" },
  { key: "hoursLogged", label: "Hours", color: "hsl(199 89% 48%)" },
  { key: "correctionsReceived", label: "Corrections", color: "hsl(25 95% 53%)" },
] as const;

export function ScorecardPeriodTrends({
  monthly,
  quarterly,
}: {
  monthly: ScorecardPeriodTrendPoint[];
  quarterly: ScorecardPeriodTrendPoint[];
}) {
  const [metric, setMetric] = useState<(typeof METRIC_OPTIONS)[number]["key"]>(
    "packagesCompleted"
  );

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Performance trends</CardTitle>
        <p className="text-xs text-muted-foreground">
          Monthly and quarterly history for completions, hours, QA, and corrections
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly">
          <TabsList className="mb-4">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2 mb-4">
            {METRIC_OPTIONS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  metric === m.key
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <TabsContent value="monthly">
            <PeriodCharts data={monthly} volumeKey={metric} />
          </TabsContent>
          <TabsContent value="quarterly">
            <PeriodCharts data={quarterly} volumeKey={metric} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PeriodCharts({
  data,
  volumeKey,
}: {
  data: ScorecardPeriodTrendPoint[];
  volumeKey: "packagesCompleted" | "hoursLogged" | "correctionsReceived";
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Volume & workload</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              yAxisId="left"
              dataKey={volumeKey}
              name={
                volumeKey === "packagesCompleted"
                  ? "Completed"
                  : volumeKey === "hoursLogged"
                    ? "Hours"
                    : "Corrections"
              }
              fill="hsl(262 83% 58%)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="activeWork"
              name="Active"
              fill="hsl(199 89% 48%)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="overdueWork"
              name="Overdue"
              fill="hsl(0 72% 51%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Quality & resolution</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" domain={[0, 100]} orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              yAxisId="left"
              dataKey="correctionsResolved"
              name="Resolved"
              fill="hsl(142 71% 45%)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="qaPassRate"
              name="QA pass %"
              stroke="hsl(262 83% 58%)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avgCompletionTimeHours"
              name="Avg hrs/pkg"
              stroke="hsl(38 92% 50%)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
