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

  const cards = [
    {
      id: "rate",
      label: "Production rate",
      value: pct(data.productionRateChangePct),
      sub:
        data.monday.docsPerPersonDay != null && data.flow.docsPerPersonDay != null
          ? `${data.monday.docsPerPersonDay} → ${data.flow.docsPerPersonDay} docs/person-day`
          : "needs more Flow history",
      good: (data.productionRateChangePct ?? 0) > 0,
    },
    {
      id: "time",
      label: "Time per document",
      value: pct(data.timePerDocChangePct),
      sub:
        data.monday.minutesPerDoc != null && data.flow.minutesPerDoc != null
          ? `${data.monday.minutesPerDoc}m → ${data.flow.minutesPerDoc}m avg`
          : "needs more Flow history",
      good: (data.timePerDocChangePct ?? 0) < 0,
    },
    {
      id: "monthly",
      label: "Saved per month",
      value: money(data.savings.dollarsSavedPerMonth),
      sub:
        data.savings.hoursSavedPerMonth != null
          ? `${data.savings.hoursSavedPerMonth}h at $${data.savings.wagePerHour}/hr`
          : "computes once both eras have rates",
      good: (data.savings.dollarsSavedPerMonth ?? 0) > 0,
    },
    {
      id: "annual",
      label: "Projected annual",
      value: money(data.savings.dollarsSavedPerYear),
      sub: "at current pace",
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
            <h3 className="text-sm font-medium">Docs per person-day, weekly</h3>
            <p className="text-xs text-muted-foreground">
              Gray = Monday.com era · green = Flow era
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
            uploaded documents. $ at ${data.savings.wagePerHour}/hr wage only — real savings run
            higher.
          </p>
        </div>
      </div>
    </div>
  );
}
