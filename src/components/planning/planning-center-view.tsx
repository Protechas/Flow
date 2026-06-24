"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { KpiStrip } from "@/components/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { PlanningCalendarView } from "@/components/planning/planning-calendar-view";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { FORECAST_KPI_HELP } from "@/lib/help/help-text";
import { simulateWhatIf } from "@/lib/planning/impact-preview";
import type { PlanningCenterSnapshot } from "@/lib/planning/types";
import {
  capacityStatusLabel,
  outcomeLabel,
  riskLabel,
} from "@/lib/planning/utils";
import { operationsHref } from "@/lib/navigation/deep-links";
import type { Department, ForecastComplexityLevel, ForecastSettings, Project, User, WorkPackage } from "@/types/flow";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

export function PlanningCenterView({
  snapshot,
  settings,
  departments,
  projects,
  analysts,
  workPackages,
  teams,
}: {
  snapshot: PlanningCenterSnapshot;
  settings: ForecastSettings;
  departments: Department[];
  projects: Project[];
  analysts: User[];
  workPackages: WorkPackage[];
  teams: { id: string; department_id: string }[];
}) {
  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{snapshot.scopeLabel}</p>
        <p className="text-sm text-muted-foreground max-w-3xl">
          What is happening now, what is likely to happen next, and where leadership should focus —
          based on live assignments, forecasts, capacity, and compliance data.
        </p>
      </header>

      <EnterpriseSection title="Current Operations Status" id="status" helpKey="operationsOverview">
        <KpiStrip columns={4} items={snapshot.operationsStatus} />
      </EnterpriseSection>

      <EnterpriseSection title="Work Visibility" id="visibility" helpKey="workVisibilityScore">
        <KpiStrip
          columns={4}
          items={[
            {
              label: OPS_COPY.workVisibilityScore,
              value: `${snapshot.workVisibility.score}%`,
              href: "/reports/work-visibility",
              warn: snapshot.workVisibility.score < 85,
              helpKey: "workVisibilityScore",
            },
            {
              label: OPS_COPY.taskTrackingCompliance,
              value: `${snapshot.workVisibility.taskTrackingCompliancePct}%`,
              href: "/reports/work-visibility",
              helpKey: "taskTrackingCompliance",
            },
            {
              label: OPS_COPY.activityGap,
              value: snapshot.workVisibility.openActivityGaps,
              href: "/reports/work-visibility#gaps",
              warn: snapshot.workVisibility.openActivityGaps > 0,
              helpKey: "activityGaps",
            },
            {
              label: "Employees With Gaps",
              value: snapshot.workVisibility.employeesWithGaps,
              href: "/reports/work-visibility#gaps",
              warn: snapshot.workVisibility.employeesWithGaps > 0,
              helpKey: "employeesWithGaps",
            },
          ]}
        />
      </EnterpriseSection>

      <EnterpriseSection title="Company Forecast" id="forecast" helpKey="forecastCompletion">
        <KpiStrip
          columns={4}
          items={[
            {
              label: "On-Time Projects",
              value: snapshot.executiveForecast.projectsForecastedOnTime,
              href: "/project-health",
              helpKey: FORECAST_KPI_HELP["On-Time Projects"],
            },
            {
              label: "Late Projects",
              value: snapshot.executiveForecast.projectsForecastedLate,
              warn: snapshot.executiveForecast.projectsForecastedLate > 0,
              href: "/project-health?risk=at_risk",
              helpKey: FORECAST_KPI_HELP["Late Projects"],
            },
            {
              label: "Forecast Completion Rate",
              value: `${snapshot.executiveForecast.forecastCompletionRate}%`,
              helpKey: FORECAST_KPI_HELP["Forecast Completion Rate"],
            },
            {
              label: "Capacity Utilization",
              value: `${snapshot.executiveForecast.capacityUtilizationPct}%`,
              warn: snapshot.executiveForecast.capacityUtilizationPct >= 75,
              helpKey: FORECAST_KPI_HELP["Capacity Utilization"],
            },
            {
              label: "Expected Backlog (hrs)",
              value: snapshot.executiveForecast.expectedBacklogHours,
              helpKey: FORECAST_KPI_HELP["Expected Backlog (hrs)"],
            },
            {
              label: "Deliveries This Week",
              value: snapshot.executiveForecast.expectedDeliveriesThisWeek,
              href: operationsHref(),
              helpKey: FORECAST_KPI_HELP["Deliveries This Week"],
            },
            {
              label: "Expected QA Volume",
              value: snapshot.executiveForecast.expectedQaVolume,
              href: "/qa-center",
              helpKey: FORECAST_KPI_HELP["Expected QA Volume"],
            },
            {
              label: "Forecast Confidence",
              value: `${snapshot.executiveForecast.forecastConfidence}%`,
              helpKey: FORECAST_KPI_HELP["Forecast Confidence"],
            },
          ]}
        />
        <p className="text-xs text-muted-foreground mt-3">
          Operational risk level:{" "}
          <span className="font-medium text-foreground">
            {riskLabel(snapshot.executiveForecast.operationalRiskLevel)}
          </span>
          {" · "}
          Expected compliance rate: {snapshot.executiveForecast.expectedComplianceRate}%
        </p>
      </EnterpriseSection>

      <EnterpriseSection
        title="Forecast Calendar"
        id="calendar"
        description="Month and week views of task forecasts, committed due dates, project completions, and department workload peaks — linked to Operations and Projects."
      >
        <PlanningCalendarView
          snapshot={snapshot}
          workPackages={workPackages}
          projects={projects}
          departments={departments}
        />
      </EnterpriseSection>

      <EnterpriseSection title="Expected Outcomes" id="outcomes">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OutcomeCard label="Completions This Week" value={snapshot.expectedOutcomes.projectCompletionsThisWeek} />
          <OutcomeCard label="Completions This Month" value={snapshot.expectedOutcomes.projectCompletionsThisMonth} />
          <OutcomeCard label="Likely On Time" value={snapshot.expectedOutcomes.projectsLikelyOnTime} trend="up" />
          <OutcomeCard label="Likely Late" value={snapshot.expectedOutcomes.projectsLikelyLate} trend="down" warn />
          <OutcomeCard label="Available Capacity (hrs)" value={snapshot.expectedOutcomes.expectedAvailableCapacityHours} />
          <OutcomeCard label="Expected QA Workload" value={snapshot.expectedOutcomes.expectedQaWorkload} />
          <OutcomeCard label="Compliance Rate" value={`${snapshot.expectedOutcomes.expectedComplianceRate}%`} />
          <OutcomeCard label="Backlog (hrs)" value={snapshot.executiveForecast.expectedBacklogHours} />
        </div>
      </EnterpriseSection>

      {snapshot.recommendations.length > 0 && (
        <EnterpriseSection title="Recommended Actions" id="actions">
          <ul className="space-y-2">
            {snapshot.recommendations.map((rec) => (
              <li
                key={rec.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/10 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={rec.priority === "high" ? "destructive" : "outline"} className="text-[10px]">
                      {rec.priority}
                    </Badge>
                    <span className="font-medium text-sm">{rec.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{rec.reasoning}</p>
                </div>
                {rec.href && (
                  <Button size="sm" variant="outline" render={<Link href={rec.href} />}>
                    Review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </EnterpriseSection>
      )}

      <EnterpriseSection title="Department Forecasting" id="departments">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Capacity</th>
                <th className="py-2 pr-3 font-medium">Assigned Hrs</th>
                <th className="py-2 pr-3 font-medium">Available Hrs</th>
                <th className="py-2 pr-3 font-medium">At Risk</th>
                <th className="py-2 pr-3 font-medium">Forecast Date</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.departmentForecasts.map((d) => (
                <tr key={d.departmentId} className="border-b border-border/40 hover:bg-muted/15">
                  <td className="py-2.5 pr-3 font-medium">
                    <Link href={operationsHref({ department: d.departmentId })} className="hover:text-primary">
                      {d.departmentName}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{d.currentCapacityPct}%</td>
                  <td className="py-2.5 pr-3 tabular-nums">{d.assignedHours}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{d.availableHours}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{d.projectsAtRisk}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{d.forecastCompletionDate ?? "—"}</td>
                  <td className="py-2.5">
                    <Badge variant="outline" title={d.recommendedAction}>
                      {capacityStatusLabel(d.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EnterpriseSection>

      <EnterpriseSection title="Project Forecasting" id="projects">
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {snapshot.projectForecasts.map((p) => (
            <div
              key={p.projectId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/10"
            >
              <div>
                <Link href={`/projects?projectId=${p.projectId}`} className="font-medium hover:text-primary">
                  {p.projectName}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.progressPct}% complete · {p.remainingHours}h remaining ·{" "}
                  {outcomeLabel(p.expectedOutcome)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  p.riskLevel === "critical" || p.riskLevel === "at_risk"
                    ? "border-warning/50 text-warning"
                    : ""
                )}
              >
                {riskLabel(p.riskLevel)}
              </Badge>
            </div>
          ))}
        </div>
      </EnterpriseSection>

      <EnterpriseSection title="Task Forecasting" id="tasks">
        <div className="space-y-2 max-h-[480px] overflow-y-auto">
          {snapshot.taskForecasts.map((t) => (
            <div
              key={t.taskId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/10"
            >
              <div className="min-w-0">
                <Link href={operationsHref({ package: t.taskId })} className="font-medium hover:text-primary truncate block">
                  {t.taskTitle}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.projectName}
                  {t.assigneeName ? ` · ${t.assigneeName}` : ""} · {t.documentsRemaining} docs remaining ·{" "}
                  {t.estimatedRemainingHours}h
                </p>
              </div>
              <Badge variant="outline">{outcomeLabel(t.expectedOutcome)}</Badge>
            </div>
          ))}
        </div>
      </EnterpriseSection>

      <WhatIfPanel
        settings={settings}
        departments={departments}
        projects={projects}
        analysts={analysts}
        workPackages={workPackages}
        teams={teams}
      />
    </div>
  );
}

function OutcomeCard({
  label,
  value,
  trend,
  warn,
}: {
  label: string;
  value: string | number;
  trend?: "up" | "down";
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-muted/10 px-4 py-3",
        warn && "border-warning/40"
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
        {trend === "down" && <TrendingDown className="h-4 w-4 text-warning" />}
      </div>
    </div>
  );
}

function WhatIfPanel({
  settings,
  departments,
  projects,
  analysts,
  workPackages,
  teams,
}: {
  settings: ForecastSettings;
  departments: Department[];
  projects: Project[];
  analysts: User[];
  workPackages: WorkPackage[];
  teams: { id: string; department_id: string }[];
}) {
  const [docCount, setDocCount] = useState("50");
  const [complexity, setComplexity] = useState<ForecastComplexityLevel>("standard");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "__none__");
  const [assigneeId, setAssigneeId] = useState("__none__");

  const result = useMemo(() => {
    const docs = Number(docCount) || 0;
    if (docs <= 0) return null;
    return simulateWhatIf(
      {
        documentCount: docs,
        complexity,
        departmentId: departmentId || null,
        projectId: projectId !== "__none__" ? projectId : null,
        assigneeId: assigneeId !== "__none__" ? assigneeId : null,
      },
      {
        users: analysts,
        packages: workPackages,
        projects,
        teams,
        settings,
        departments: departments.map((d) => ({ id: d.id, name: d.name })),
      }
    );
  }, [docCount, complexity, departmentId, projectId, assigneeId, analysts, projects, workPackages, teams, settings]);

  return (
    <EnterpriseSection
      title="What-If Simulator"
      id="what-if"
      description="Simulate adding work without saving. Adjust inputs to see forecast, capacity, and risk impact instantly."
      helpKey="whatIfSimulator"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border/50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Document count</Label>
              <Input type="number" min={1} value={docCount} onChange={(e) => setDocCount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Complexity</Label>
              <Select value={complexity} onValueChange={(v) => v && setComplexity(v as ForecastComplexityLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Department</Label>
            <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
              <SelectTrigger>
                <EntitySelectValue
                  value={departmentId}
                  items={departments}
                  getLabel={(d) => d.name}
                  placeholder="Select department"
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Project (optional)</Label>
            <Select value={projectId} onValueChange={(v) => v && setProjectId(v)}>
              <SelectTrigger>
                <EntitySelectValue
                  value={projectId}
                  items={projects}
                  getLabel={(p) => p.name}
                  placeholder="None"
                  sentinels={[{ value: "__none__", label: "None" }]}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-2 text-sm">
          {!result ? (
            <p className="text-muted-foreground">Enter document count to simulate impact.</p>
          ) : (
            <>
              <p><span className="text-muted-foreground">Estimated hours:</span> {result.taskHours.toFixed(1)}</p>
              <p><span className="text-muted-foreground">Work days:</span> {result.taskDays.toFixed(1)}</p>
              <p><span className="text-muted-foreground">Suggested due:</span> {result.suggestedDue ?? "—"}</p>
              <p><span className="text-muted-foreground">Dept capacity after:</span> {result.departmentCapacityAfterPct}%</p>
              <p><span className="text-muted-foreground">Project days added:</span> {result.projectDaysAdded}</p>
              <p><span className="text-muted-foreground">Risk:</span> {riskLabel(result.riskLevel)}</p>
              <p><span className="text-muted-foreground">Expected outcome:</span> {outcomeLabel(result.expectedOutcome)}</p>
            </>
          )}
          <p className="text-[10px] text-muted-foreground pt-2">Simulation only — no changes are saved until you create the task.</p>
        </div>
      </div>
    </EnterpriseSection>
  );
}
