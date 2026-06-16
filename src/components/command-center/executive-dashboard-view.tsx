"use client";

import Link from "next/link";
import { ActivityFeed } from "@/components/enterprise/activity-feed";
import {
  DepartmentHealthBadge,
  DepartmentHealthMeter,
} from "@/components/enterprise/department-health-badge";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
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
import { cn } from "@/lib/utils";
import type { CommandCenterMetrics, UserRole } from "@/types/flow";
import {
  Activity,
  Building2,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  TrendingDown,
} from "lucide-react";

function SignalStrip({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={cn(className, "transition-colors hover:border-primary/30")}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

function linkHref(role: UserRole, href: string): string | undefined {
  return canAccessHref(role, href) ? href : undefined;
}

function CommandPulse({ warn }: { warn: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className={cn(
          "relative flex h-2.5 w-2.5",
          warn ? "text-amber-400" : "text-emerald-400"
        )}
      >
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40",
            warn ? "bg-amber-400" : "bg-emerald-400"
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            warn ? "bg-amber-400" : "bg-emerald-400"
          )}
        />
      </span>
      {warn ? "Attention required" : "Operations nominal"}
    </span>
  );
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
    forecastRisk > 0;

  const productivityTrend =
    data.trends30.length >= 2
      ? data.trends30[data.trends30.length - 1].flowScore - data.trends30[0].flowScore
      : undefined;

  return (
    <div className="flow-executive-dashboard space-y-8">
      {/* Command header */}
      <section className="flow-executive-command-strip enterprise-panel-elevated p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-primary">
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Dashboard
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              How is the company doing right now?
            </h2>
            <p className="text-sm text-muted-foreground">
              Live operational posture across departments, workforce, delivery, quality, and
              forecast — updated from production data.
            </p>
            <CommandPulse warn={needsAttention} />
          </div>
          <div className="flex flex-wrap gap-2">
            {linkHref(role, "/org-chart") && (
              <Button size="sm" variant="outline" render={<Link href="/org-chart" />}>
                Org Chart
              </Button>
            )}
            {linkHref(role, "/alert-center") && (
              <Button size="sm" variant="outline" render={<Link href="/alert-center" />}>
                Alert Center
              </Button>
            )}
            {linkHref(role, "/notifications") && (
              <Button size="sm" variant="outline" render={<Link href="/notifications" />}>
                Notifications
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Primary executive KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <EnterpriseKpi
          label="Department Health"
          value={avgDeptHealth}
          sublabel={
            deptsAtRisk > 0
              ? `${deptsAtRisk} dept${deptsAtRisk === 1 ? "" : "s"} need attention`
              : `${data.departmentHealth.length} departments monitored`
          }
          href={linkHref(role, "/reports")}
          warn={deptsAtRisk > 0}
        />
        <EnterpriseKpi
          label="Employees Online"
          value={data.workforce.clockedIn}
          sublabel={`${data.workforce.activeTaskTimers} active task timers`}
          href={linkHref(role, "/time-clock")}
        />
        <EnterpriseKpi
          label="Projects Active"
          value={data.projectHealth.active}
          sublabel={`${data.projectHealth.onTrack} on track`}
          href={linkHref(role, "/project-health")}
        />
        <EnterpriseKpi
          label="Tasks Active"
          value={data.workload.active}
          sublabel={`${data.workload.inProgress} in progress`}
          href={linkHref(role, "/operations")}
        />
        <EnterpriseKpi
          label="Forecast Risk"
          value={forecastRisk}
          sublabel={`${data.forecast.tasksBehindForecast} tasks · ${data.forecast.projectsBehindForecast} projects behind`}
          href={linkHref(role, "/project-health")}
          warn={forecastRisk > 0}
        />
        <EnterpriseKpi
          label="QA Performance"
          value={`${data.qaHealth.passRate}%`}
          sublabel={`${data.qaHealth.queueSize} in queue · ${data.qaHealth.correctionsToday} corrections today`}
          href={linkHref(role, "/qa-center")}
          warn={data.qaHealth.passRate < 85 || data.qaHealth.queueSize > 5}
        />
        <EnterpriseKpi
          label="Workload Risk"
          value={data.workloadAlertSummary.open}
          sublabel={
            data.workloadAlertSummary.critical > 0
              ? `${data.workloadAlertSummary.critical} critical`
              : "Employees low on work"
          }
          href={linkHref(role, alertCenterHref({ type: "workload" }))}
          warn={data.workloadAlertSummary.open > 0}
        />
        <EnterpriseKpi
          label="Help Requests"
          value={data.helpFlagSummary.open}
          sublabel={
            data.helpFlagSummary.critical > 0
              ? `${data.helpFlagSummary.critical} critical`
              : "Open help flags"
          }
          href={linkHref(role, alertCenterHref({ type: "help" }))}
          warn={data.helpFlagSummary.open > 0}
        />
        <EnterpriseKpi
          label="Missing Wrap-Ups"
          value={data.wrapUpReview.missingToday}
          sublabel={`${data.wrapUpReview.submittedToday} submitted today`}
          href={linkHref(role, wrapUpsHref({ status: "missing" }))}
          warn={data.wrapUpReview.missingToday > 0}
        />
        <EnterpriseKpi
          label="Operational Health"
          value={data.teamHealth.flowScore}
          sublabel="Company Flow Score"
          href={linkHref(role, "/performance")}
          trend={
            productivityTrend !== undefined
              ? { delta: productivityTrend, label: "30d trend" }
              : undefined
          }
        />
        <EnterpriseKpi
          label="Department Capacity"
          value={`${data.workforce.capacityUtilizationPct}%`}
          sublabel="Avg utilization vs target"
          href={linkHref(role, "/reports")}
          warn={data.workforce.capacityUtilizationPct > 90}
        />
        <EnterpriseKpi
          label="Overdue Tasks"
          value={data.workload.overdue}
          sublabel={`${data.workload.stuck} stuck`}
          href={linkHref(role, operationsHref({ view: "overdue" }))}
          warn={data.workload.overdue > 0}
        />
      </section>

      {/* Trends + Department health */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <PerformanceTrendChart
            data={data.trends30}
            title="Productivity Trends"
            description="30-day Flow Score, productivity, and quality trajectory"
          />
        </div>
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="enterprise-section-title">Department Health</h3>
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
        <div className="enterprise-panel-elevated p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="enterprise-section-title">Department Capacity</h3>
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
                      <span>{project.overdue} overdue</span>
                      <span>QA {project.qaRate}%</span>
                      <span>{project.hoursLogged}h logged</span>
                    </div>
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

      {/* Signal strips — no tables */}
      {(data.helpFlagSummary.open > 0 || data.workloadAlertSummary.open > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.helpFlagSummary.open > 0 && (
            <SignalStrip
              href={linkHref(role, "/alert-center")}
              className="enterprise-panel p-4 flex items-center gap-3"
            >
              <HelpCircle className="h-8 w-8 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold">{data.helpFlagSummary.open} help requests</p>
                <p className="text-xs text-muted-foreground">
                  {data.helpFlagSummary.critical} critical · employees need assistance
                </p>
              </div>
            </SignalStrip>
          )}
          {data.workloadAlertSummary.open > 0 && (
            <SignalStrip
              href={linkHref(role, "/operations")}
              className="enterprise-panel p-4 flex items-center gap-3"
            >
              <TrendingDown className="h-8 w-8 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold">{data.workloadAlertSummary.open} workload alerts</p>
                <p className="text-xs text-muted-foreground">
                  Employees running low on assigned work
                </p>
              </div>
            </SignalStrip>
          )}
        </div>
      )}

      {/* Recent activity */}
      <section className="flow-live-panel">
        <div className="flow-live-panel-header flex items-center justify-between gap-3">
          <div>
            <h3 className="enterprise-section-title">Recent Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last {data.recentActivity.length} operational events
            </p>
          </div>
          {linkHref(role, "/operations") && (
            <Button size="sm" variant="ghost" render={<Link href="/operations" />}>
              Operations
            </Button>
          )}
        </div>
        <div className="px-4 py-2">
          <ActivityFeed events={data.recentActivity} maxItems={14} />
        </div>
      </section>

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
