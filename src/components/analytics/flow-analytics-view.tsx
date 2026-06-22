"use client";

import { OPS_COPY } from "@/lib/copy/executive-terminology";
import Link from "next/link";
import {
  DepartmentHealthBadge,
  DepartmentHealthMeter,
} from "@/components/enterprise/department-health-badge";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HEALTH_LEVEL_LABELS, type DepartmentHealthLevel } from "@/lib/design/department-health";
import {
  alertCenterHref,
  operationsHref,
  peopleHref,
  projectHealthHref,
  qaCenterHref,
} from "@/lib/navigation/deep-links";
import { cn } from "@/lib/utils";
import type { FlowAnalyticsSnapshot } from "@/lib/analytics/types";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Clock,
  FolderKanban,
  LifeBuoy,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ComparisonBarChart({
  data,
  valueKey,
  labelKey,
  unit = "",
  color = "var(--chart-1)",
}: {
  data: Record<string, string | number>[];
  valueKey: string;
  labelKey: string;
  unit?: string;
  color?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data for this period.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={100}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            fontSize: 12,
          }}
          formatter={(v) => [`${v ?? 0}${unit}`, ""]}
        />
        <Bar dataKey={valueKey} fill={color} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RankCard({
  rank,
  title,
  subtitle,
  value,
  warn,
}: {
  rank?: number;
  title: string;
  subtitle?: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "enterprise-panel p-3 space-y-1 min-w-0",
        warn && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-center gap-2">
        {rank != null && (
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-5">#{rank}</span>
        )}
        <p className="font-medium text-sm truncate">{title}</p>
      </div>
      <p className={cn("text-lg font-semibold tabular-nums", warn && "text-warning")}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
    </div>
  );
}

export function FlowAnalyticsView({ data }: { data: FlowAnalyticsSnapshot }) {
  const h = data.headline;

  const speedChartData = data.employee.speedRankings.slice(0, 8).map((e) => ({
    name: e.name.split(" ")[0],
    docsPerHour: e.docsPerHour,
  }));

  const qaTeamChartData = data.qa.byTeam.slice(0, 8).map((t) => ({
    name: t.teamName,
    passRate: t.passRate,
  }));

  const deptHealthChartData = data.department.health.slice(0, 8).map((d) => ({
    name: d.departmentName,
    score: d.score,
  }));

  return (
    <div className="flow-analytics-engine flow-ambient-command space-y-8">
      {/* Command header */}
      <section className="flow-executive-command-strip enterprise-panel-elevated p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-primary">
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Flow Analytics Engine
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Business analytics from live production data
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.scopeLabel} · Last {data.periodDays} days · Tasks, forecast, timeclock, files,
              QA, wrap-ups, workload alerts, and help flags
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href="/reports" />}>
              Reports
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/production" />}>
              Production
            </Button>
          </div>
        </div>
      </section>

      {/* Headline answers */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EnterpriseKpi
          label="Fastest employee"
          value={h.fastestEmployee?.name.split(" ")[0] ?? "—"}
          sublabel={
            h.fastestEmployee
              ? `${h.fastestEmployee.docsPerHour} docs/hr · ${h.fastestEmployee.avgMinutesPerDocument} min/doc`
              : "Insufficient submissions"
          }
          href={h.fastestEmployee ? peopleHref(h.fastestEmployee.userId) : undefined}
          spotlight
        />
        <EnterpriseKpi
          label="Avg min / document"
          value={h.orgAvgMinutesPerDocument || "—"}
          sublabel="Real average from file uploads & task time"
        />
        <EnterpriseKpi
          label="Top QA team"
          value={h.topQaTeam?.teamName ?? "—"}
          sublabel={
            h.topQaTeam ? `${h.topQaTeam.passRate}% pass · ${h.topQaTeam.reviewCount} reviews` : "No reviews"
          }
        />
        <EnterpriseKpi
          label="Projects behind"
          value={h.projectsBehind}
          sublabel="At risk or behind forecast"
          warn={h.projectsBehind > 0}
          href={projectHealthHref()}
        />
        <EnterpriseKpi
          label="Most overloaded"
          value={h.mostOverloaded?.name.split(" ")[0] ?? "—"}
          sublabel={h.mostOverloaded ? `${h.mostOverloaded.active} active tasks` : "Balanced"}
          warn={!!h.mostOverloaded}
          href={h.mostOverloaded ? peopleHref(h.mostOverloaded.userId) : undefined}
        />
        <EnterpriseKpi
          label="Most underutilized"
          value={h.mostUnderutilized?.name.split(" ")[0] ?? "—"}
          sublabel={h.mostUnderutilized ? `${h.mostUnderutilized.active} active tasks` : "Balanced"}
          href={h.mostUnderutilized ? peopleHref(h.mostUnderutilized.userId) : undefined}
        />
        <EnterpriseKpi
          label="Needs work"
          value={h.employeesNeedingWork}
          sublabel="Workload alerts — low or no assignments"
          href={alertCenterHref({ type: "workload" })}
          warn={h.employeesNeedingWork > 0}
        />
        <EnterpriseKpi
          label="Struggling dept"
          value={h.strugglingDepartment?.departmentName ?? "—"}
          sublabel={
            h.strugglingDepartment
              ? `Health ${h.strugglingDepartment.score} · ${HEALTH_LEVEL_LABELS[h.strugglingDepartment.level as DepartmentHealthLevel]}`
              : "All departments healthy"
          }
          warn={!!h.strugglingDepartment}
        />
      </section>

      {/* Trends */}
      <div className="grid gap-6 xl:grid-cols-2">
        <PerformanceTrendChart
          data={data.trends.flowScore}
          title={`${OPS_COPY.operationsScore} trend`}
          description="Team performance trajectory"
        />
        <EnterpriseSection title="Minutes per document trend" description={`${data.periodDays}-day production pace`}>
          <div className="enterprise-panel-elevated p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trends.minutesPerDocumentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </EnterpriseSection>
      </div>

      {/* Employee Analytics */}
      <EnterpriseSection
        title="Employee Analytics"
        description={`Speed, workload balance, and ${OPS_COPY.operationsScore.toLowerCase()} leaders`}
        workspace
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="enterprise-label flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" /> Speed rankings (docs/hour)
            </p>
            <ComparisonBarChart
              data={speedChartData}
              valueKey="docsPerHour"
              labelKey="name"
              color="var(--chart-2)"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {data.employee.speedRankings.slice(0, 4).map((e) => (
                <RankCard
                  key={e.userId}
                  rank={e.rank}
                  title={e.name}
                  value={`${e.docsPerHour} docs/hr`}
                  subtitle={`${e.avgMinutesPerDocument} min/doc · ${e.fileCount} files`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <p className="enterprise-label flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Workload comparison
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="enterprise-panel p-3 text-center">
                <p className="text-2xl font-semibold text-warning tabular-nums">
                  {data.employee.overloaded.length}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Overloaded</p>
              </div>
              <div className="enterprise-panel p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums">
                  {data.employee.underutilized.length}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Underutilized</p>
              </div>
              <div className="enterprise-panel p-3 text-center">
                <p className="text-2xl font-semibold text-amber-400 tabular-nums">
                  {data.employee.needsWork.length}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Needs work</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {data.employee.workload
                .filter((w) => w.flag)
                .sort((a, b) => b.active - a.active)
                .slice(0, 8)
                .map((w) => (
                  <div
                    key={w.userId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                      w.flag === "overloaded" && "border-red-500/25 bg-red-500/5",
                      w.flag === "underutilized" && "border-blue-500/25 bg-blue-500/5",
                      w.flag === "needs_work" && "border-amber-500/25 bg-amber-500/5"
                    )}
                  >
                    <span className="font-medium truncate">{w.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 capitalize">
                      {w.flag?.replace("_", " ")} · {w.active} active
                    </span>
                  </div>
                ))}
            </div>
            <p className="enterprise-label">{OPS_COPY.operationsScore} leaders</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.employee.flowScoreLeaders.slice(0, 4).map((e, i) => (
                <RankCard
                  key={e.userId}
                  rank={i + 1}
                  title={e.name}
                  value={String(e.flowScore)}
                  subtitle={e.trendDelta >= 0 ? `+${e.trendDelta} trend` : `${e.trendDelta} trend`}
                />
              ))}
            </div>
          </div>
        </div>
      </EnterpriseSection>

      {/* Department Analytics */}
      <EnterpriseSection
        title="Department Analytics"
        description="Health scores, production throughput, and struggling departments"
        workspace
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <ComparisonBarChart
              data={deptHealthChartData}
              valueKey="score"
              labelKey="name"
              unit=""
              color="var(--chart-4)"
            />
          </div>
          <div className="flow-dept-health-grid grid sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto">
            {data.department.health.map((dept) => (
              <div key={dept.departmentId} className="enterprise-panel p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm truncate">{dept.departmentName}</p>
                  <DepartmentHealthBadge level={dept.level} score={dept.score} size="sm" />
                </div>
                <DepartmentHealthMeter score={dept.score} level={dept.level} />
                <p className="text-[10px] text-muted-foreground">{dept.factors.join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>
      </EnterpriseSection>

      {/* Manager Analytics */}
      <EnterpriseSection
        title="Manager Analytics"
        description="Team status, coaching signals, and recognition opportunities"
        workspace
      >
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <EnterpriseKpi label={`Team ${OPS_COPY.operationsScore}`} value={data.manager.teamFlowScore} />
          <EnterpriseKpi label="Avg QA pass" value={`${data.manager.avgQaPassRate}%`} />
          <EnterpriseKpi label="On-time rate" value={`${data.manager.avgOnTimeRate}%`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.manager.insights.slice(0, 9).map((insight) => (
            <div
              key={`${insight.userId}-${insight.category}`}
              className={cn(
                "enterprise-panel p-3 space-y-1",
                insight.category === "coaching" && "border-amber-500/25",
                insight.category === "support" && "border-blue-500/25",
                insight.category === "recognition" && "border-emerald-500/25"
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">
                {insight.category}
              </p>
              <p className="font-medium text-sm">{insight.name}</p>
              <p className="text-xs text-muted-foreground">{insight.reason}</p>
              <p className="text-xs tabular-nums">Flow {insight.flowScore}</p>
            </div>
          ))}
        </div>
      </EnterpriseSection>

      {/* Forecast Analytics */}
      <EnterpriseSection title="Forecast Analytics" description="Delivery risk and estimate coverage" workspace>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <EnterpriseKpi label="Tasks at risk" value={data.forecast.tasksAtRisk} warn={data.forecast.tasksAtRisk > 0} href={operationsHref({ view: "at_risk" })} />
          <EnterpriseKpi label="Projects at risk" value={data.forecast.projectsAtRisk} warn={data.forecast.projectsAtRisk > 0} href={projectHealthHref()} />
          <EnterpriseKpi label="Behind forecast" value={data.forecast.tasksBehindActiveForecast} warn={data.forecast.tasksBehindActiveForecast > 0} href={operationsHref({ view: "at_risk" })} />
          <EnterpriseKpi label="Missing estimates" value={data.forecast.tasksMissingEstimates} warn={data.forecast.tasksMissingEstimates > 0} href="/operations" />
        </div>
        <div className="space-y-3">
          <p className="enterprise-label flex items-center gap-2">
            <FolderKanban className="h-3.5 w-3.5" /> Projects falling behind
          </p>
          {data.forecast.projectsFallingBehind.length === 0 ? (
            <p className="text-sm text-muted-foreground enterprise-panel p-4 text-center">
              No projects currently behind schedule.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.forecast.projectsFallingBehind.slice(0, 6).map((p) => (
                <div
                  key={p.projectId}
                  className="enterprise-panel p-4 space-y-2 border-amber-500/20"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-sm">{p.name}</p>
                    <span className="text-[10px] uppercase text-amber-400 shrink-0">
                      {p.behindForecast ? "Behind forecast" : p.status.replace("_", " ")}
                    </span>
                  </div>
                  <Progress value={p.completedPct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {p.completedPct}% · {p.overdue} overdue · QA {p.qaRate}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </EnterpriseSection>

      {/* QA Analytics */}
      <EnterpriseSection title="QA Analytics" description="Quality by team, department, and individual" workspace>
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <EnterpriseKpi label="Org QA pass" value={`${data.qa.orgPassRate}%`} href={qaCenterHref()} />
          <EnterpriseKpi label="Corrections today" value={data.qa.correctionsToday} warn={data.qa.correctionsToday > 0} href={qaCenterHref()} />
          <EnterpriseKpi label="Corrections (7d)" value={data.qa.correctionsWeek} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="enterprise-label mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> QA success by team
            </p>
            <ComparisonBarChart
              data={qaTeamChartData}
              valueKey="passRate"
              labelKey="name"
              unit="%"
              color="var(--chart-3)"
            />
          </div>
          <div className="space-y-2">
            <p className="enterprise-label">Teams ranked by pass rate</p>
            {data.qa.byTeam.slice(0, 6).map((t, i) => (
              <RankCard
                key={t.teamId}
                rank={i + 1}
                title={t.teamName}
                value={`${t.passRate}%`}
                subtitle={`${t.departmentName} · ${t.reviewCount} reviews`}
              />
            ))}
            {data.qa.lowPerformers.length > 0 && (
              <>
                <p className="enterprise-label mt-4 flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> QA coaching targets
                </p>
                {data.qa.lowPerformers.slice(0, 4).map((e) => (
                  <RankCard
                    key={e.userId}
                    title={e.name}
                    value={`${e.passRate}%`}
                    subtitle={`${e.corrections} corrections`}
                    warn
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </EnterpriseSection>

      {/* Capacity Analytics */}
      <EnterpriseSection title="Capacity Analytics" description="Workforce utilization and department load" workspace>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <EnterpriseKpi label="Clocked in" value={data.capacity.clockedIn} />
          <EnterpriseKpi label="Active timers" value={data.capacity.activeTaskTimers} />
          <EnterpriseKpi
            label="Utilization"
            value={`${data.capacity.capacityUtilizationPct}%`}
            warn={data.capacity.capacityUtilizationPct > 90}
          />
          <EnterpriseKpi label="Unused capacity" value={`${data.capacity.unusedCapacityHours}h`} />
        </div>
        <div className="space-y-3">
          {data.capacity.departmentLoad.map((dept) => {
            const maxH = Math.max(...data.capacity.departmentLoad.map((d) => d.estimatedHours), 1);
            const pct = Math.round((dept.estimatedHours / maxH) * 100);
            return (
              <div key={dept.departmentId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{dept.departmentName}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {dept.estimatedHours}h · {dept.activeTasks} tasks
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>
      </EnterpriseSection>

      {/* Workload Analytics */}
      <EnterpriseSection
        title="Workload Analytics"
        description="Alerts, help flags, and wrap-up compliance"
        workspace
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <EnterpriseKpi
            label="Workload alerts"
            value={data.workload.openAlerts}
            warn={data.workload.openAlerts > 0}
          />
          <EnterpriseKpi
            label="No work assigned"
            value={data.workload.noWorkCount}
            warn={data.workload.noWorkCount > 0}
          />
          <EnterpriseKpi
            label="Help requests"
            value={data.workload.openHelpFlags}
            warn={data.workload.openHelpFlags > 0}
          />
          <EnterpriseKpi
            label={OPS_COPY.outstandingDailyReports}
            value={data.workload.wrapUpMissing}
            warn={data.workload.wrapUpMissing > 0}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="enterprise-panel p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold">{data.workload.lowWorkloadCount} low-workload alerts</p>
              <p className="text-xs text-muted-foreground">Employees running out of assigned work</p>
            </div>
          </div>
          <div className="enterprise-panel p-4 flex items-center gap-3">
            <LifeBuoy className="h-8 w-8 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold">
                {data.workload.criticalHelpFlags} critical help flags
              </p>
              <p className="text-xs text-muted-foreground">
                {data.workload.openHelpFlags} open total
              </p>
            </div>
          </div>
        </div>
        {data.workload.byDepartmentAlerts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="enterprise-label flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Alerts by department
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.workload.byDepartmentAlerts.map((d) => (
                <div key={d.departmentId} className="enterprise-panel px-3 py-2 flex justify-between text-sm">
                  <span className="truncate">{d.departmentName}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                    {d.alertCount}
                    {d.criticalCount > 0 && (
                      <span className="text-red-400 ml-1">({d.criticalCount} crit)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </EnterpriseSection>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-1 pb-4">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Generated {new Date(data.generatedAt).toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {data.trends.production.reduce((s, t) => s + t.submissions, 0)} submissions in period
        </span>
      </footer>
    </div>
  );
}
