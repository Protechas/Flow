import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EmployeeScorecard, ScorecardMetrics, TeamScorecardSummary } from "@/types/flow";
import { cn } from "@/lib/utils";

function compareMetric(
  value: number,
  avg: number,
  opts?: { suffix?: string; lowerBetter?: boolean }
): { label: string; pct: number; good: boolean } {
  const suffix = opts?.suffix ?? "";
  const lowerBetter = opts?.lowerBetter ?? false;
  const delta = value - avg;
  const good = lowerBetter ? delta <= 0 : delta >= 0;
  const pct = avg === 0 ? (value > 0 ? 100 : 0) : Math.min(100, Math.round((value / avg) * 100));
  const sign = delta > 0 ? "+" : "";
  return {
    label: `${value}${suffix} (${sign}${Math.round(delta * 10) / 10}${suffix} vs team ${avg}${suffix})`,
    pct,
    good,
  };
}

const DRILL_METRICS: {
  key: keyof ScorecardMetrics;
  label: string;
  suffix?: string;
  lowerBetter?: boolean;
}[] = [
  { key: "packagesCompleted", label: "Packages completed" },
  { key: "hoursLogged", label: "Hours logged" },
  { key: "avgCompletionTimeHours", label: "Avg completion time", suffix: "h", lowerBetter: true },
  { key: "qaPassRate", label: "QA pass rate", suffix: "%" },
  { key: "correctionsReceived", label: "Corrections received", lowerBetter: true },
  { key: "correctionsResolved", label: "Corrections resolved" },
  { key: "overdueWork", label: "Overdue work", lowerBetter: true },
  { key: "activeWork", label: "Active work" },
];

export function ManagerDrillDownPanel({
  scorecard,
  teamSummary,
}: {
  scorecard: EmployeeScorecard;
  teamSummary: TeamScorecardSummary;
}) {
  const avg = teamSummary.averages;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Manager drill-down</CardTitle>
        <p className="text-xs text-muted-foreground">
          {scorecard.user.full_name} vs team averages ({teamSummary.employeeCount} employees)
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {DRILL_METRICS.map(({ key, label, suffix, lowerBetter }) => {
          const value = scorecard.metrics[key] as number;
          const teamVal = avg[key] as number;
          const cmp = compareMetric(value, teamVal, { suffix, lowerBetter });
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    "tabular-nums text-xs",
                    cmp.good ? "text-emerald-400" : "text-amber-400"
                  )}
                >
                  {cmp.label}
                </span>
              </div>
              <Progress
                value={cmp.pct}
                className={cn("h-2", !cmp.good && "opacity-90")}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
