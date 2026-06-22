import { formatMinutes } from "@/lib/production/metrics";

export function WorkDaySummaryPanel({
  clockedMinutes,
  recordedTaskMinutes,
  unassignedMinutes,
  taskTrackingCompliancePct,
}: {
  clockedMinutes: number;
  recordedTaskMinutes: number;
  unassignedMinutes: number;
  taskTrackingCompliancePct: number | null;
}) {
  if (clockedMinutes <= 0 && recordedTaskMinutes <= 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2 text-xs">
      <p className="font-medium text-sm">Today&apos;s activity summary</p>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Clocked hours" value={formatMinutes(clockedMinutes)} />
        <Metric label="Recorded task hours" value={formatMinutes(recordedTaskMinutes)} />
        <Metric
          label="Unassigned time"
          value={formatMinutes(unassignedMinutes)}
          warn={unassignedMinutes > 15}
        />
        <Metric
          label="Task tracking compliance"
          value={taskTrackingCompliancePct != null ? `${taskTrackingCompliancePct}%` : "—"}
        />
      </div>
      {unassignedMinutes > 0 && (
        <p className="text-muted-foreground pt-1">
          Unassigned time is clocked time not yet linked to a task record. Document non-task
          activity below if applicable.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums ${warn ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
