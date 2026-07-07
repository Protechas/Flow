"use client";

import Link from "next/link";
import {
  DepartmentHealthBadge,
  DepartmentHealthMeter,
} from "@/components/enterprise/department-health-badge";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import {
  KpiPriorityZone,
  LiveActivityStream,
  OperationalInsightList,
  OperationalPulsePanel,
  OperationalSignalCard,
} from "@/components/platform";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { canAccessHref } from "@/lib/auth/permissions";
import {
  alertCenterHref,
  operationsHref,
  projectHealthHref,
  reportsHref,
  wrapUpsHref,
} from "@/lib/navigation/deep-links";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import type { CommandCenterMetrics, UserRole } from "@/types/flow";
import {
  Activity,
  Building2,
  FolderKanban,
  HelpCircle,
  TrendingDown,
} from "lucide-react";

function linkHref(role: UserRole, href: string): string | undefined {
  return canAccessHref(role, href) ? href : undefined;
}

function pulseStatus(
  needsAttention: boolean,
  critical: boolean
): "nominal" | "attention" | "critical" {
  if (critical) return "critical";
  if (needsAttention) return "attention";
  return "nominal";
}

export function ExecutiveDashboardView({
  data,
  role,
}: {
  data: CommandCenterMetrics;
  role: UserRole;
}) {
  const avgDeptHealth =
    data.departmentHealth.length > 0
      ? Math.round(
          data.departmentHealth.reduce((s, d) => s + d.score, 0) /
            data.departmentHealth.length
        )
      : 0;
  const deptsAtRisk = data.departmentHealth.filter(
    (d) => d.level === "at_risk" || d.level === "critical"
  ).length;
  const forecastRisk =
    data.forecast.tasksBehindForecast +
    data.forecast.projectsBehindForecast +
    data.forecast.tasksAtRisk;
  const atRiskProjects = data.projectHealth.projects.filter(
    (p) => p.status === "at_risk"
  );

  const needsAttention =
    deptsAtRisk > 0 ||
    data.helpFlagSummary.open > 0 ||
    data.workloadAlertSummary.open > 0 ||
    data.wrapUpReview.missingToday > 0 ||
    data.projectHealth.atRisk > 0 ||
    forecastRisk > 0 ||
    data.activityGaps.length > 0;

  const hasCritical =
    data.helpFlagSummary.critical > 0 ||
    data.workloadAlertSummary.critical > 0 ||
    data.departmentHealth.some((d) => d.level === "critical");

  const productivityTrend =
    data.trends30.length >= 2
      ? data.trends30[data.trends30.length - 1].flowScore - data.trends30[0].flowScore
      : undefined;

  return (
    <div className="flow-executive-dashboard flow-ambient-command space-y-10">
      <OperationalPulsePanel
        pulseStatus={pulseStatus(needsAttention, hasCritical)}
        actions={
          <>
            {linkHref(role, "/alert-center") && (
              <Button
                size="sm"
                variant={needsAttention ? "default" : "outline"}
                render={<Link href="/alert-center" />}
              >
                Alert Center
              </Button>
            )}
            {linkHref(role, "/planning") && (
              <Button size="sm" variant="outline" render={<Link href="/planning" />}>
                Planning & Forecasting
              </Button>
            )}
            {linkHref(role, "/org-chart") && (
              <Button size="sm" variant="outline" render={<Link href="/org-chart" />}>
                Org Chart
              </Button>
            )}
            {linkHref(role, "/notifications") && (
              <Button size="sm" variant="outline" render={<Link href="/notifications" />}>
                Notifications
              </Button>
            )}
          </>
        }
        metrics={[
          {
            id: "health",
            label: OPS_COPY.operationsScore,
            value: data.teamHealth.flowScore,
            sublabel: OPS_COPY.operationsScore,
            href: linkHref(role, "/performance"),
            tone: data.teamHealth.flowScore >= 75 ? "healthy" : "warning",
            helpKey: "operationsScore",
          },
          {
            id: "online",
            label: OPS_COPY.employeesClockedIn,
            value: data.workforce.clockedIn,
            sublabel: `${data.workforce.activeTaskTimers} active timers`,
            href: linkHref(role, "/time-clock"),
            tone: data.workforce.clockedIn > 0 ? "healthy" : "neutral",
            helpKey: "employeesClockedIn",
          },
          {
            id: "help",
            label: OPS_COPY.openEscalations,
            value: data.helpFlagSummary.open,
            sublabel:
              data.helpFlagSummary.critical > 0
                ? `${data.helpFlagSummary.critical} critical`
                : "Open requests",
            href: linkHref(role, alertCenterHref({ type: "help" })),
            tone: data.helpFlagSummary.open > 0 ? "critical" : "healthy",
            helpKey: "openEscalations",
          },
          {
            id: "visibility",
            label: OPS_COPY.workVisibilityScore,
            value: `${data.workVisibility.score}%`,
            sublabel: `${data.workVisibility.taskTrackingCompliancePct}% task tracking`,
            href: linkHref(role, "/reports/work-visibility"),
            tone: data.workVisibility.score >= 85 ? "healthy" : "warning",
            helpKey: "workVisibilityScore",
          },
          {
            id: "activity_gaps",
            label: OPS_COPY.activityGap,
            value: data.activityGaps.length,
            sublabel:
              data.activityGaps.length > 0
                ? `${new Set(data.activityGaps.map((g) => g.employee_id)).size} employees`
                : "No open gaps",
            href: linkHref(role, alertCenterHref({ type: "activity_gaps" })),
            tone: data.activityGaps.length > 0 ? "warning" : "healthy",
            helpKey: "activityGaps",
          },
          {
            id: "work",
            label: OPS_COPY.availableCapacity,
            value: data.workloadAlertSummary.open,
            sublabel: "Low workload alerts",
            href: linkHref(role, alertCenterHref({ type: "workload" })),
            tone: data.workloadAlertSummary.open > 0 ? "warning" : "healthy",
            helpKey: "availableCapacity",
          },
          {
            id: "wrapup",
            label: OPS_COPY.outstandingDailyReports,
            value: data.wrapUpReview.missingToday,
            sublabel: `${data.wrapUpReview.submittedToday} submitted today`,
            href: linkHref(role, wrapUpsHref({ status: "missing" })),
            // Missing reports are an attention state, not a QA concept —
            // purple here made the tile read as unrelated to urgency
            tone: data.wrapUpReview.missingToday > 0 ? "warning" : "healthy",
            helpKey: "outstandingDailyReports",
          },
          {
            id: "forecast",
            label: OPS_COPY.projectsAtRisk,
            value: forecastRisk,
            sublabel: `${data.forecast.tasksAtRisk} tasks at risk`,
            href: linkHref(role, "/planning") ?? linkHref(role, "/project-health"),
            tone: forecastRisk > 0 ? "warning" : "healthy",
            helpKey: "projectsAtRisk",
          },
          {
            id: "qa",
            label: OPS_COPY.qaPerformance,
            value: `${data.qaHealth.passRate}%`,
            sublabel: `${data.qaHealth.queueSize} in queue`,
            href: linkHref(role, "/qa-center"),
            tone:
              data.qaHealth.passRate < 85 || data.qaHealth.queueSize > 5 ? "qa" : "healthy",
            helpKey: "qaPerformance",
          },
        ]}
      />

      {data.outcomeMetrics.length > 0 && (
        <KpiPriorityZone
          title="Project outcomes"
          description="Aggregated success metrics across active projects"
          variant="overview"
        >
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.outcomeMetrics.map((metric) => (
              <EnterpriseKpi
                key={metric.id}
                label={metric.metric_name}
                value={metric.aggregate_value}
                sublabel={`${metric.project_count} project${metric.project_count === 1 ? "" : "s"} · ${metric.unit_label}`}
                href={linkHref(role, "/projects")}
                helpKey="customProjectMetrics"
              />
            ))}
          </section>
        </KpiPriorityZone>
      )}

      {/* Only surface the QA zone once validation has real data — empty "—"
          tiles read as broken, not as "not started yet". */}
      {data.validationSummary &&
        (data.validationSummary.completedRuns > 0 ||
          data.validationSummary.openFindings > 0) &&
        linkHref(role, "/qa-center/validation") && (
        <KpiPriorityZone
          title="QA Center"
          description="Library audit compliance and open correction workload"
          variant="overview"
        >
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.validationSummary.libraryAccuracyPct != null && (
              <EnterpriseKpi
                label="Library accuracy"
                value={`${data.validationSummary.libraryAccuracyPct}%`}
                sublabel={`${data.validationSummary.completedRuns} completed runs`}
                href="/qa-center/validation"
              />
            )}
            <EnterpriseKpi
              label="Open findings"
              value={data.validationSummary.openFindings}
              sublabel={
                data.validationSummary.criticalFindingsOpen > 0
                  ? `${data.validationSummary.criticalFindingsOpen} critical/high`
                  : "Across all engines"
              }
              href="/qa-center/validation/findings"
              warn={data.validationSummary.openFindings > 0}
              critical={data.validationSummary.criticalFindingsOpen > 0}
            />
            {data.validationSummary.revalidationImprovementPct != null && (
              <EnterpriseKpi
                label="Revalidation improvement"
                value={`${data.validationSummary.revalidationImprovementPct >= 0 ? "+" : ""}${data.validationSummary.revalidationImprovementPct}%`}
                sublabel="Avg compliance delta on linked reruns"
                href="/qa-center/validation/history"
              />
            )}
          </section>
        </KpiPriorityZone>
      )}

      <KpiPriorityZone
        title={OPS_COPY.requiresAttention}
        description="Signals that may need manager action today"
        variant="attention"
        helpKey="requiresAttention"
      >
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 relative z-[1]">
          <EnterpriseKpi
            label={OPS_COPY.openEscalations}
            value={data.helpFlagSummary.open}
            sublabel={
              data.helpFlagSummary.critical > 0
                ? `${data.helpFlagSummary.critical} critical`
                : "Open escalation requests"
            }
            href={linkHref(role, alertCenterHref({ type: "help" }))}
            warn={data.helpFlagSummary.open > 0}
            critical={data.helpFlagSummary.critical > 0}
            priority="high"
            helpKey="openEscalations"
          />
          <EnterpriseKpi
            label={OPS_COPY.projectsAtRisk}
            value={forecastRisk}
            sublabel={`${data.forecast.tasksBehindForecast} tasks · ${data.forecast.projectsBehindForecast} projects behind`}
            href={linkHref(role, "/project-health")}
            warn={forecastRisk > 0}
            priority="high"
            helpKey="projectsAtRisk"
          />
          <EnterpriseKpi
            label={OPS_COPY.outstandingDailyReports}
            value={data.wrapUpReview.missingToday}
            sublabel={`${data.wrapUpReview.submittedToday} submitted today`}
            href={linkHref(role, wrapUpsHref({ status: "missing" }))}
            warn={data.wrapUpReview.missingToday > 0}
            priority="high"
            helpKey="outstandingDailyReports"
          />
          <EnterpriseKpi
            label={OPS_COPY.overdueTasks}
            value={data.workload.overdue}
            sublabel={`${data.workload.stuck} stuck`}
            href={linkHref(role, operationsHref({ view: "overdue" }))}
            warn={data.workload.overdue > 0}
            critical={data.workload.overdue > 5}
            priority="high"
            helpKey="overdueTasks"
          />
        </section>
      </KpiPriorityZone>

      <KpiPriorityZone
        title={OPS_COPY.operationsOverview}
        description="Workforce, delivery, and department performance"
        variant="overview"
        helpKey="operationsOverview"
      >
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <EnterpriseKpi
          label={OPS_COPY.departmentHealth}
          value={avgDeptHealth}
          sublabel={
            deptsAtRisk > 0
              ? `${deptsAtRisk} dept${deptsAtRisk === 1 ? "" : "s"} need attention`
              : `${data.departmentHealth.length} departments monitored`
          }
          href={linkHref(role, "/reports")}
          warn={deptsAtRisk > 0}
          helpKey="departmentHealth"
        />
        <EnterpriseKpi
          label={OPS_COPY.employeesClockedIn}
          value={data.workforce.clockedIn}
          sublabel={`${data.workforce.activeTaskTimers} active task timers`}
          href={linkHref(role, "/time-clock")}
          priority="low"
          helpKey="employeesClockedIn"
        />
        <EnterpriseKpi
          label={OPS_COPY.activeProjects}
          value={data.projectHealth.active}
          sublabel={`${data.projectHealth.onTrack} on track`}
          href={linkHref(role, "/project-health")}
          priority="low"
          helpKey="activeProjects"
        />
        <EnterpriseKpi
          label={OPS_COPY.activeTasks}
          value={data.workload.active}
          sublabel={`${data.workload.inProgress} in progress`}
          href={linkHref(role, "/operations")}
          priority="low"
          helpKey="activeTasks"
        />
        <EnterpriseKpi
          label={OPS_COPY.qaPerformance}
          value={`${data.qaHealth.passRate}%`}
          sublabel={`${data.qaHealth.queueSize} in queue · ${data.qaHealth.correctionsToday} corrections today`}
          href={linkHref(role, "/qa-center")}
          warn={data.qaHealth.passRate < 85 || data.qaHealth.queueSize > 5}
          helpKey="qaPerformance"
        />
        <EnterpriseKpi
          label={OPS_COPY.workloadRisk}
          value={data.workloadAlertSummary.open}
          sublabel={
            data.workloadAlertSummary.critical > 0
              ? `${data.workloadAlertSummary.critical} critical`
              : "Employees low on work"
          }
          href={linkHref(role, alertCenterHref({ type: "workload" }))}
          warn={data.workloadAlertSummary.open > 0}
          helpKey="workloadRisk"
        />
        <EnterpriseKpi
          label={OPS_COPY.operationsScore}
          value={data.teamHealth.flowScore}
          sublabel={OPS_COPY.operationsScore}
          href={linkHref(role, "/performance")}
          trend={
            productivityTrend !== undefined
              ? { delta: productivityTrend, label: "30d trend" }
              : undefined
          }
          spotlight
          priority="high"
          helpKey="operationsScore"
        />
        <EnterpriseKpi
          label={OPS_COPY.capacityUtilization}
          value={`${data.workforce.capacityUtilizationPct}%`}
          sublabel="Avg utilization vs target"
          href={linkHref(role, "/reports")}
          warn={data.workforce.capacityUtilizationPct > 90}
          priority="low"
          helpKey="capacityUtilization"
        />
        </section>
      </KpiPriorityZone>

      {/* Operational insights */}
      {data.insights.length > 0 && (
        <OperationalInsightList insights={data.insights} maxItems={5} />
      )}

      {/* Trends + Department health */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <PerformanceTrendChart
            data={data.trends30}
            title="Productivity Trends"
            description="30-day Operations Score, productivity, and quality trajectory"
          />
        </div>
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="enterprise-section-title">{OPS_COPY.departmentHealth}</h3>
          </div>
          <div className="flow-dept-health-grid grid sm:grid-cols-2 max-h-[340px] overflow-y-auto enterprise-panel-elevated">
            {data.departmentHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No active departments.</p>
            ) : (
              data.departmentHealth.map((dept) => {
                const deptHref = linkHref(role, reportsHref({ department: dept.departmentId }));
                const card = (
                  <div className="enterprise-panel p-3 space-y-2 flow-card-interactive">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate">{dept.departmentName}</p>
                      <DepartmentHealthBadge level={dept.level} score={dept.score} size="sm" />
                    </div>
                    <DepartmentHealthMeter score={dept.score} level={dept.level} />
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {dept.factors.join(" · ")}
                    </p>
                    <div className="flex gap-3 text-[10px] text-muted-foreground tabular-nums">
                      <span>{dept.activeTasks} active</span>
                      <span>{dept.overdueTasks} overdue</span>
                      <span>QA {dept.qaPassRate}%</span>
                    </div>
                  </div>
                );
                return deptHref ? (
                  <Link key={dept.departmentId} href={deptHref} title={`View ${dept.departmentName} reports`}>
                    {card}
                  </Link>
                ) : (
                  <div key={dept.departmentId}>{card}</div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Capacity + At-risk projects */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="enterprise-panel-elevated p-5 space-y-4 flow-workspace-tier-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="enterprise-section-title">{OPS_COPY.capacityUtilization}</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Estimated hours loaded by department · {data.workforce.capacityUtilizationPct}% org
            utilization
          </p>
          <div className="space-y-3">
            {data.forecast.departmentLoad.length === 0 ? (
              <p className="text-sm text-muted-foreground">No department load data.</p>
            ) : (
              data.forecast.departmentLoad.map((dept) => {
                const maxHours = Math.max(
                  ...data.forecast.departmentLoad.map((d) => d.estimatedHours),
                  1
                );
                const pct = Math.round((dept.estimatedHours / maxHours) * 100);
                return (
                  <div key={dept.departmentId} className="space-y-1.5">
                    <div className="flex justify-between text-sm gap-2">
                      <span className="font-medium truncate">{dept.departmentName}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {dept.estimatedHours}h · {dept.activeTasks} tasks
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="enterprise-panel-elevated p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-amber-400" />
              <h3 className="enterprise-section-title">At-Risk Projects</h3>
            </div>
            {linkHref(role, "/project-health") && (
              <Button size="sm" variant="ghost" render={<Link href="/project-health" />}>
                View all
              </Button>
            )}
          </div>
          {atRiskProjects.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-6 text-center">
              <p className="text-sm text-emerald-400/90">No projects currently at risk.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {atRiskProjects.map((project) => {
                const projectHref = linkHref(
                  role,
                  projectHealthHref({ search: project.name })
                );
                const card = (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-2 flow-card-interactive">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">{project.name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-amber-400 shrink-0">
                        At risk
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{project.completedPct}% complete</span>
                      {project.landingHeadline &&
                        project.status === "at_risk" &&
                        project.landingHeadline !== "On track for target date" && (
                          <span className="text-warning">{project.landingHeadline}</span>
                        )}
                      <span>{project.overdue} overdue</span>
                      <span>QA {project.qaRate}%</span>
                      <span>{project.hoursLogged}h logged</span>
                    </div>
                    {project.primaryReason && project.status === "at_risk" && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {project.primaryReason}
                      </p>
                    )}
                    <Progress value={project.completedPct} className="h-1.5" />
                  </div>
                );
                return projectHref ? (
                  <Link key={project.id} href={projectHref} title={`View ${project.name} health`}>
                    {card}
                  </Link>
                ) : (
                  <div key={project.id}>{card}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(data.helpFlagSummary.open > 0 || data.workloadAlertSummary.open > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.helpFlagSummary.open > 0 && (
            <OperationalSignalCard
              href={linkHref(role, "/alert-center")}
              variant="help"
              icon={HelpCircle}
              title={`${data.helpFlagSummary.open} ${OPS_COPY.openEscalations.toLowerCase()}`}
              description={`${data.helpFlagSummary.critical} critical · employees need assistance`}
            />
          )}
          {data.workloadAlertSummary.open > 0 && (
            <OperationalSignalCard
              href={linkHref(role, "/operations")}
              variant="workload"
              icon={TrendingDown}
              title={`${data.workloadAlertSummary.open} capacity alerts`}
              description="Employees with available capacity for additional assignments"
            />
          )}
        </div>
      )}

      {data.accountability.attentionList.length > 0 && (
        <div className="enterprise-panel-elevated p-5 space-y-3">
          <h3 className="enterprise-section-title">People needing attention</h3>
          <ul className="space-y-2">
            {data.accountability.attentionList.slice(0, 6).map((item) => (
              <li
                key={`${item.userId}-${item.category}`}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm flow-card-interactive"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                  {item.category}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <LiveActivityStream
        events={data.recentActivity}
        maxItems={14}
        pulseStatus={pulseStatus(needsAttention, hasCritical)}
        description={`Last ${Math.min(data.recentActivity.length, 14)} operational events`}
        action={
          linkHref(role, "/operations") ? (
            <Button size="sm" variant="ghost" render={<Link href="/operations" />}>
              Operations
            </Button>
          ) : undefined
        }
      />

      {/* Footer pulse metrics */}
      <section className="grid gap-3 sm:grid-cols-3 text-center">
        <div className="enterprise-panel px-4 py-3">
          <p className="enterprise-label">Team Quality</p>
          <p className="flow-metric-lg mt-1">{data.teamHealth.qualityScore}</p>
        </div>
        <div className="enterprise-panel px-4 py-3">
          <p className="enterprise-label">On-Time Delivery</p>
          <p className="flow-metric-lg mt-1">{data.teamHealth.onTimeScore}%</p>
        </div>
        <div className="enterprise-panel px-4 py-3">
          <p className="enterprise-label">QA Turnaround</p>
          <p className="flow-metric-lg mt-1">{data.qaHealth.avgTurnaroundHours}h</p>
        </div>
      </section>
    </div>
  );
}
