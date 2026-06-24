"use client";

import Link from "next/link";
import { useState } from "react";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMinutes } from "@/lib/production/metrics";
import type {
  ActivityGapView,
  EmployeeWorkVisibilityMetrics,
  WorkVisibilitySummary,
  WorkVisibilityTrendPoint,
} from "@/types/flow";
import { cn } from "@/lib/utils";
import { WORK_VISIBILITY_CHIP_HELP } from "@/lib/help/help-text";
import type { HelpTextKey } from "@/lib/help/help-text";
import { ChevronDown, ChevronRight } from "lucide-react";

const ACTIVITY_CATEGORIES = [
  { value: "meeting", label: "Meeting" },
  { value: "training", label: "Training" },
  { value: "research", label: "Research" },
  { value: "supervisor_request", label: "Supervisor request" },
  { value: "qa_review", label: "QA review" },
  { value: "administrative", label: "Administrative work" },
  { value: "system_issue", label: "System issue" },
  { value: "other", label: "Other" },
] as const;

export function WorkVisibilityReportView({
  summary,
  employees,
  activityGaps,
  trend7,
  trend30,
  trend90,
  highlightUserId,
  complianceTargetPct,
}: {
  summary: WorkVisibilitySummary;
  employees: EmployeeWorkVisibilityMetrics[];
  activityGaps: ActivityGapView[];
  trend7: WorkVisibilityTrendPoint[];
  trend30: WorkVisibilityTrendPoint[];
  trend90: WorkVisibilityTrendPoint[];
  highlightUserId?: string;
  complianceTargetPct: number;
}) {
  const [range, setRange] = useState<"7" | "30" | "90">("7");
  const [expandedId, setExpandedId] = useState<string | null>(highlightUserId ?? null);

  const trend =
    range === "7" ? trend7 : range === "30" ? trend30 : trend90;

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Operational visibility across task tracking, daily reports, workload coverage, and activity
          documentation. Drill into individual records for detail.
        </p>
      </header>

      <EnterpriseSection title="Work Visibility Score" id="score" helpKey="workVisibilityScore">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-4xl font-semibold tabular-nums">{summary.score}%</p>
            <p className="text-xs text-muted-foreground mt-1">Composite operational visibility</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs flex-1 min-w-[240px]">
            <ScoreChip label="Task tracking" value={`${summary.taskTrackingCompliancePct}%`} helpKey="taskTrackingCompliance" />
            <ScoreChip label="Daily reports" value={`${summary.dailyReportCompliancePct}%`} helpKey="dailyReportCompliance" />
            <ScoreChip label="Workload coverage" value={`${summary.workloadCoveragePct}%`} helpKey="workloadCoverage" />
            <ScoreChip label="Capacity visibility" value={`${summary.capacityVisibilityPct}%`} helpKey="capacityVisibility" />
            <ScoreChip label="Work documentation" value={`${summary.workDocumentationPct}%`} helpKey="workDocumentation" />
            {summary.openActivityGaps > 0 && (
              <ScoreChip
                label="Activity gaps"
                value={String(summary.openActivityGaps)}
                warn
                helpKey="activityGaps"
              />
            )}
          </div>
        </div>
      </EnterpriseSection>

      <EnterpriseSection
        title="Trend"
        id="trend"
        description="Rolling visibility score and compliance."
        actions={
          <Select value={range} onValueChange={(v) => v && setRange(v as typeof range)}>
            <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/40">
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-right py-2 font-medium">Score</th>
                <th className="text-right py-2 font-medium">Task tracking</th>
                <th className="text-right py-2 font-medium">Daily reports</th>
              </tr>
            </thead>
            <tbody>
              {trend.slice(-14).map((row) => (
                <tr key={row.date} className="border-b border-border/20">
                  <td className="py-2">{row.date}</td>
                  <td className="py-2 text-right tabular-nums">{row.score}%</td>
                  <td className="py-2 text-right tabular-nums">{row.taskTrackingCompliancePct}%</td>
                  <td className="py-2 text-right tabular-nums">{row.dailyReportCompliancePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EnterpriseSection>

      {activityGaps.length > 0 && (
        <EnterpriseSection title="Activity gaps" id="gaps" description="Informational — no active work record on clocked sessions.">
          <div className="space-y-2">
            {activityGaps.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div>
                  <Link href={`/people/${g.employee_id}`} className="font-medium hover:text-primary">
                    {g.employee_name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">{g.message}</p>
                </div>
                <Badge variant="outline">{g.gap_minutes}m</Badge>
              </div>
            ))}
          </div>
        </EnterpriseSection>
      )}

      <EnterpriseSection
        title="Work Visibility Details"
        id="details"
        description={`Task tracking target: ${complianceTargetPct}%. Expand a row for full metrics.`}
      >
        <div className="space-y-1">
          {employees.map((e) => {
            const open = expandedId === e.userId;
            const belowTarget =
              e.taskTrackingCompliancePct != null &&
              e.taskTrackingCompliancePct < complianceTargetPct;
            return (
              <div
                key={e.userId}
                className={cn(
                  "rounded-lg border border-border/50",
                  highlightUserId === e.userId && "border-primary/40",
                  e.hasActiveActivityGap && "border-warning/40"
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/10"
                  onClick={() => setExpandedId(open ? null : e.userId)}
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium flex-1 min-w-0 truncate">{e.userName}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {e.departmentName ?? "—"}
                  </span>
                  <span className="text-xs tabular-nums">
                    {e.taskTrackingCompliancePct != null
                      ? `${e.taskTrackingCompliancePct}% tracking`
                      : "—"}
                  </span>
                  {belowTarget && <Badge variant="outline">Below target</Badge>}
                  {e.hasActiveActivityGap && (
                    <Badge variant="outline">Activity gap</Badge>
                  )}
                </button>
                {open && (
                  <div className="border-t border-border/40 px-3 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <Detail label="Clocked hours" value={formatMinutes(e.clockedMinutes)} />
                    <Detail label="Recorded task hours" value={formatMinutes(e.recordedTaskMinutes)} />
                    <Detail label="Unassigned time" value={formatMinutes(e.unassignedMinutes)} />
                    <Detail
                      label="Task tracking compliance"
                      value={
                        e.taskTrackingCompliancePct != null
                          ? `${e.taskTrackingCompliancePct}%`
                          : "—"
                      }
                    />
                    <Detail label="Documents completed" value={String(e.documentsCompleted)} />
                    <Detail
                      label="QA accuracy"
                      value={e.qaAccuracyPct != null ? `${e.qaAccuracyPct}%` : "—"}
                    />
                    <Detail
                      label="Daily report compliance"
                      value={
                        e.dailyReportCompliancePct != null
                          ? `${e.dailyReportCompliancePct}%`
                          : "—"
                      }
                    />
                    <Detail
                      label="Workload coverage"
                      value={
                        e.workloadCoveragePct != null ? `${e.workloadCoveragePct}%` : "—"
                      }
                    />
                    <Detail
                      label="Capacity utilization"
                      value={
                        e.capacityUtilizationPct != null
                          ? `${e.capacityUtilizationPct}%`
                          : "—"
                      }
                    />
                    {e.activityNotes && (
                      <div className="col-span-full">
                        <p className="text-muted-foreground">Activity notes</p>
                        <p className="mt-0.5">{e.activityNotes}</p>
                      </div>
                    )}
                    <div className="col-span-full pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        render={<Link href={`/people/${e.userId}`} />}
                      >
                        View employee record
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </EnterpriseSection>

      <p className="text-[10px] text-muted-foreground max-w-2xl">
        {ACTIVITY_CATEGORIES.map((c) => c.label).join(" · ")} — activity documentation categories
        available at daily report submission.
      </p>
    </div>
  );
}

function ScoreChip({
  label,
  value,
  warn,
  helpKey,
}: {
  label: string;
  value: string;
  warn?: boolean;
  helpKey?: HelpTextKey;
}) {
  return (
    <div className={cn("rounded-md border border-border/40 px-2 py-1.5", warn && "border-warning/40")}>
      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
        {label}
        <InfoTooltip helpKey={helpKey ?? WORK_VISIBILITY_CHIP_HELP[label]} />
      </p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
