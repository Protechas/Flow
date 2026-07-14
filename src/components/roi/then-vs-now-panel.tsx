"use client";

import type { ThenVsNowSummary } from "@/lib/legacy/then-vs-now";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n}%`;
}

function money(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

/** Monday.com era vs live Flow production — the improvement story. */
export function ThenVsNowPanel({ data }: { data: ThenVsNowSummary }) {
  const chartData = data.weekly.map((p) => ({
    week: p.week.slice(2),
    monday: p.era === "monday" ? p.docsPerPersonDay : null,
    flow: p.era === "flow" ? p.docsPerPersonDay : null,
  }));

  // Measured minutes of doc work per person-day: rate × volume. The Monday
  // number is small because Monday could only SEE a sliver of the day — that
  // gap is the visibility story, not a 30x productivity claim.
  const measuredMins = (perDoc: number | null, perDay: number | null) =>
    perDoc != null && perDay != null ? Math.round(perDoc * perDay) : null;
  const mondayMeasured = measuredMins(data.monday.minutesPerDoc, data.monday.docsPerPersonDay);
  const flowMeasured = measuredMins(data.flow.minutesPerDoc, data.flow.docsPerPersonDay);
  const fmtMins = (m: number | null) =>
    m == null ? "—" : m >= 90 ? `${Math.round(m / 6) / 10}h` : `${m}m`;

  const cards = [
    {
      id: "time",
      label: "Time per document",
      value: pct(data.timePerDocChangePct),
      sub:
        data.monday.minutesPerDoc != null && data.flow.minutesPerDoc != null
          ? `${data.monday.minutesPerDoc}m → ${data.flow.minutesPerDoc}m, both measured per item`
          : "needs more Flow history",
      good: (data.timePerDocChangePct ?? 0) < 0,
    },
    {
      id: "visibility",
      label: "Measured work per person-day",
      value: `${fmtMins(mondayMeasured)} → ${fmtMins(flowMeasured)}`,
      sub: "how much of the day each tool could actually see",
      good: (flowMeasured ?? 0) > (mondayMeasured ?? 0),
    },
    {
      id: "monthly",
      label: "Capacity gained per month",
      value: money(data.savings.dollarsSavedPerMonth),
      sub:
        data.savings.hoursSavedPerMonth != null
          ? `${Math.round(data.savings.hoursSavedPerMonth).toLocaleString()}h vs old rate at $${data.savings.wagePerHour}/hr — hiring avoided, not payroll cut`
          : "computes once both eras have rates",
      good: (data.savings.dollarsSavedPerMonth ?? 0) > 0,
    },
    {
      id: "annual",
      label: "Annual capacity value",
      value: money(data.savings.dollarsSavedPerYear),
      sub: "today's volume at the old rate would need this much extra labor",
      good: (data.savings.dollarsSavedPerYear ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.id} className="enterprise-panel p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p
              className={`text-2xl font-semibold tabular-nums mt-1 ${
                c.good ? "text-emerald-400" : ""
              }`}
            >
              {c.value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="enterprise-panel p-4">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">Measured docs per person-day, weekly</h3>
            <p className="text-xs text-muted-foreground">
              Gray = Monday.com era · green = Flow era — the jump is mostly work Monday never saw
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Monday {data.monday.firstWeek ?? "—"} → {data.monday.lastWeek ?? "—"} · Flow since{" "}
            {data.flow.sinceDate}
          </p>
        </div>
        <div className="h-56 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                dataKey="monday"
                name="Monday era"
                stroke="#888780"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                dataKey="flow"
                name="Flow era"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="enterprise-panel p-4">
          <p className="text-xs text-muted-foreground">Monday era on record</p>
          <p className="text-lg font-semibold tabular-nums mt-1">
            {data.monday.doneItems.toLocaleString()} items done
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {data.monday.people} people · {data.monday.clockedItems.toLocaleString()} with real
            clock times
          </p>
        </div>
        <div className="enterprise-panel p-4">
          <p className="text-xs text-muted-foreground">Flow era so far</p>
          <p className="text-lg font-semibold tabular-nums mt-1">
            {data.flow.docsDone.toLocaleString()} documents
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {data.flow.people} people · pace {data.flow.monthlyDocPace.toLocaleString()} docs/month
          </p>
        </div>
        <div className="enterprise-panel p-4">
          <p className="text-xs text-muted-foreground">Method</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Monday rate uses doc-work boards only (per-item clocks, 5s–4h sanity window); quick
            per-system checks count toward volume, never the rate. Flow rate = timer minutes over
            uploaded documents. Capacity $ = producing today&apos;s volume at the old measured
            rate, priced at ${data.savings.wagePerHour}/hr wage only (no benefits burden) —
            conservative by design.
          </p>
        </div>
      </div>
    </div>
  );
}
