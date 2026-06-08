"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlowScoreRing } from "@/components/performance/flow-score-ring";
import { Badge } from "@/components/ui/badge";
import type { EmployeeScorecard, TeamScorecardSummary } from "@/types/flow";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

type SortKey =
  | "name"
  | "flowScore"
  | "packagesCompleted"
  | "hoursLogged"
  | "qaPassRate"
  | "correctionsReceived"
  | "overdueWork"
  | "activeWork";

export function ManagerScorecardTable({
  profiles,
  teamSummary,
}: {
  profiles: EmployeeScorecard[];
  teamSummary: TeamScorecardSummary;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("flowScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const list = [...profiles];
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "name":
          av = a.user.full_name;
          bv = b.user.full_name;
          break;
        case "flowScore":
          av = a.flowScore;
          bv = b.flowScore;
          break;
        case "packagesCompleted":
          av = a.metrics.packagesCompleted;
          bv = b.metrics.packagesCompleted;
          break;
        case "hoursLogged":
          av = a.metrics.hoursLogged;
          bv = b.metrics.hoursLogged;
          break;
        case "qaPassRate":
          av = a.metrics.qaPassRate;
          bv = b.metrics.qaPassRate;
          break;
        case "correctionsReceived":
          av = a.metrics.correctionsReceived;
          bv = b.metrics.correctionsReceived;
          break;
        case "overdueWork":
          av = a.metrics.overdueWork;
          bv = b.metrics.overdueWork;
          break;
        case "activeWork":
          av = a.metrics.activeWork;
          bv = b.metrics.activeWork;
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return list;
  }, [profiles, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <th className="text-right py-3 px-3 font-medium">
        <button
          type="button"
          onClick={() => toggleSort(col)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground",
            active ? "text-violet-400" : ""
          )}
        >
          {label}
          {active &&
            (sortDir === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            ))}
        </button>
      </th>
    );
  }

  const avg = teamSummary.averages;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <TeamStat label="Employees" value={teamSummary.employeeCount} />
        <TeamStat label="Total completed" value={teamSummary.totals.packagesCompleted} />
        <TeamStat label="Team hours" value={teamSummary.totals.hoursLogged} />
        <TeamStat
          label="Open overdue"
          value={teamSummary.totals.overdueWork}
          warn={teamSummary.totals.overdueWork > 0}
        />
      </div>

      <div className="rounded-xl border border-border/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium w-12">#</th>
              <th className="text-left py-3 px-4 font-medium">
                <button type="button" onClick={() => toggleSort("name")} className="hover:text-foreground">
                  Employee
                </button>
              </th>
              <SortHeader label="Score" col="flowScore" />
              <SortHeader label="Done" col="packagesCompleted" />
              <SortHeader label="Hours" col="hoursLogged" />
              <SortHeader label="QA %" col="qaPassRate" />
              <SortHeader label="Corr." col="correctionsReceived" />
              <SortHeader label="Overdue" col="overdueWork" />
              <SortHeader label="Active" col="activeWork" />
              <th className="text-right py-3 px-3 font-medium w-24">Drill-down</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.user.id}
                className="border-t border-border/40 hover:bg-muted/20"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-violet-400 text-xs w-4">
                      {p.rank}
                    </span>
                    <FlowScoreRing score={p.flowScore} size="sm" />
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/people/${p.user.id}`}
                    className="font-medium hover:text-violet-400"
                  >
                    {p.user.full_name}
                  </Link>
                  {p.metrics.overdueWork > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] text-red-400 border-red-500/30"
                    >
                      {p.metrics.overdueWork} overdue
                    </Badge>
                  )}
                </td>
                <td className="py-3 px-3 text-right tabular-nums font-semibold">
                  {p.flowScore}
                </td>
                <MetricCell value={p.metrics.packagesCompleted} avg={avg.packagesCompleted} />
                <MetricCell value={p.metrics.hoursLogged} avg={avg.hoursLogged} />
                <MetricCell value={p.metrics.qaPassRate} avg={avg.qaPassRate} suffix="%" />
                <MetricCell value={p.metrics.correctionsReceived} avg={avg.correctionsReceived} lowerBetter />
                <MetricCell value={p.metrics.overdueWork} avg={avg.overdueWork} lowerBetter warn />
                <MetricCell value={p.metrics.activeWork} avg={avg.activeWork} />
                <td className="py-3 px-3 text-right">
                  <Link
                    href={`/people/${p.user.id}`}
                    className="text-xs text-violet-400 hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
              <td colSpan={2} className="py-2 px-4 font-medium">
                Team average
              </td>
              <td className="py-2 px-3 text-right tabular-nums">—</td>
              <td className="py-2 px-3 text-right tabular-nums">{avg.packagesCompleted}</td>
              <td className="py-2 px-3 text-right tabular-nums">{avg.hoursLogged}</td>
              <td className="py-2 px-3 text-right tabular-nums">{avg.qaPassRate}%</td>
              <td className="py-2 px-3 text-right tabular-nums">{avg.correctionsReceived}</td>
              <td className="py-2 px-3 text-right tabular-nums">{avg.overdueWork}</td>
              <td className="py-2 px-3 text-right tabular-nums">{avg.activeWork}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TeamStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        warn ? "border-red-500/30 bg-red-500/5" : "border-border/60 bg-muted/20"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", warn && "text-red-400")}>
        {value}
      </p>
    </div>
  );
}

function MetricCell({
  value,
  avg,
  suffix = "",
  lowerBetter,
  warn,
}: {
  value: number;
  avg: number;
  suffix?: string;
  lowerBetter?: boolean;
  warn?: boolean;
}) {
  const delta = value - avg;
  const good = lowerBetter ? delta <= 0 : delta >= 0;
  return (
    <td
      className={cn(
        "py-3 px-3 text-right tabular-nums",
        warn && value > 0 && "text-red-400 font-medium"
      )}
    >
      {value}
      {suffix}
      {Math.abs(delta) >= 0.5 && (
        <span
          className={cn(
            "block text-[10px]",
            good ? "text-emerald-500/80" : "text-amber-500/80"
          )}
        >
          {delta > 0 ? "+" : ""}
          {Math.round(delta * 10) / 10}
          {suffix} vs avg
        </span>
      )}
    </td>
  );
}
