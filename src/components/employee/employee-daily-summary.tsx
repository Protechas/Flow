import type { EmployeeDailySummary } from "@/types/flow";
import { CheckCircle2, Clock, RotateCcw, Shield } from "lucide-react";

export function EmployeeDailySummaryBar({ summary }: { summary: EmployeeDailySummary }) {
  const items = [
    { label: "Completed today", value: summary.tasksCompletedToday, icon: CheckCircle2 },
    { label: "Hours today", value: summary.hoursWorkedToday, icon: Clock },
    { label: "QA passes", value: summary.qaPasses, icon: Shield },
    { label: "Corrections", value: summary.correctionsReceived, icon: RotateCcw },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border/60 bg-card/50 px-3 py-3 text-center"
        >
          <item.icon className="h-4 w-4 mx-auto mb-1 text-violet-400" />
          <p className="text-xl font-bold tabular-nums">{item.value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}
