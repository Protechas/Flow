import Link from "next/link";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { EmployeeDailySummary } from "@/types/flow";
import { CheckCircle2, Clock, FileText, RotateCcw } from "lucide-react";

export function EmployeeTodayScore({
  summary,
  qaReturns,
  scorecardHref,
}: {
  summary: EmployeeDailySummary;
  qaReturns: number;
  scorecardHref?: string;
}) {
  const stats = [
    { label: "Completed", value: String(summary.tasksCompletedToday), icon: CheckCircle2 },
    {
      label: "Work time",
      value:
        summary.hoursWorkedToday > 0
          ? `${summary.hoursWorkedToday}h`
          : summary.shiftMinutesToday != null && summary.shiftMinutesToday > 0
            ? `${(summary.shiftMinutesToday / 60).toFixed(1)}h`
            : "0",
      icon: Clock,
    },
    { label: "Files", value: String(summary.documentsUploadedToday), icon: FileText },
    { label: "QA returns", value: String(qaReturns), icon: RotateCcw },
  ];

  return (
    <section className="enterprise-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Today&apos;s Score
          <InfoTooltip helpKey="todaysScore" />
        </h2>
        {scorecardHref && (
          <Link href={scorecardHref} className="text-xs text-primary hover:underline">
            Full scorecard
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="text-center space-y-1">
            <Icon className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
