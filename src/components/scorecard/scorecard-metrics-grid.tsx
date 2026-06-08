import { MetricCard } from "@/components/dashboard/metric-card";
import type { ScorecardMetrics } from "@/types/flow";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  RotateCcw,
  ShieldCheck,
  Timer,
} from "lucide-react";

export function ScorecardMetricsGrid({
  metrics,
  subtitle,
}: {
  metrics: ScorecardMetrics;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2">
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Packages Completed"
          value={metrics.packagesCompleted}
          icon={Package}
          subtitle={`${metrics.packagesCompletedMonth} this month · ${metrics.packagesCompletedQuarter} this quarter`}
        />
        <MetricCard
          title="Hours Logged"
          value={metrics.hoursLogged}
          icon={Clock}
          subtitle={`${metrics.hoursLoggedMonth} mo · ${metrics.hoursLoggedQuarter} qtr`}
        />
        <MetricCard
          title="Avg Completion Time"
          value={`${metrics.avgCompletionTimeHours}h`}
          icon={Timer}
          subtitle="Per completed package"
        />
        <MetricCard
          title="QA Pass Rate"
          value={`${metrics.qaPassRate}%`}
          icon={ShieldCheck}
        />
        <MetricCard
          title="Corrections Received"
          value={metrics.correctionsReceived}
          icon={RotateCcw}
          subtitle={`${metrics.openCorrections} open`}
        />
        <MetricCard
          title="Corrections Resolved"
          value={metrics.correctionsResolved}
          icon={CheckCircle2}
        />
        <MetricCard
          title="Overdue Work"
          value={metrics.overdueWork}
          icon={AlertTriangle}
          highlight={metrics.overdueWork > 0}
        />
        <MetricCard
          title="Active Work"
          value={metrics.activeWork}
          icon={Layers}
        />
      </div>
    </div>
  );
}
