"use client";

import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import Link from "next/link";
import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { ProjectOutcomesReportSection } from "@/components/metrics/project-outcomes-report-section";
import type { ReportMetrics } from "@/types/flow";
import { operationsHref, projectHealthHref, qaCenterHref } from "@/lib/navigation/deep-links";
import { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";
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

export function ReportMetricsView({ metrics }: { metrics: ReportMetrics }) {
  const h = metrics.hierarchySummary;
  const f = metrics.forecast;
  return (
    <div className="space-y-6">
      <div className="enterprise-panel px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{h.projects}</strong> projects</span>
        <span><strong className="text-foreground">{h.manufacturers}</strong> manufacturers</span>
        <span><strong className="text-foreground">{h.years}</strong> year nodes</span>
        <span><strong className="text-foreground">{h.packages}</strong> work packages</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EnterpriseKpi label="QA Pass Rate" value={`${metrics.qaPassRate}%`} href={qaCenterHref()} title="Open QA review" />
        <EnterpriseKpi label="Total Corrections" value={metrics.totalCorrections} href={qaCenterHref()} title="Open QA review" />
        <EnterpriseKpi label="Avg Time / Package" value={`${metrics.avgTimePerPackage}h`} href="/reports" title="View reports" />
        <EnterpriseKpi
          label="Overdue"
          value={metrics.overdueCount}
          warn={metrics.overdueCount > 0}
          href={operationsHref({ view: "overdue" })}
          title="View overdue tasks"
        />
      </div>

      <ProjectOutcomesReportSection
        outcomeMetrics={metrics.outcomeMetrics}
        projectMetricRows={metrics.projectMetricRows}
        exportFilename="flow-reports-project-metrics.csv"
      />

      <EnterpriseSection title="Due date forecasting" description="Planning and live production forecasts">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <EnterpriseKpi label="Est. documents" value={f.totalEstimatedDocuments.toLocaleString()} />
          <EnterpriseKpi label="Est. hours" value={`${f.totalEstimatedHours}h`} />
          <EnterpriseKpi label="Est. work days" value={f.totalEstimatedWorkDays} />
          <EnterpriseKpi label="Avg variance (days)" value={f.forecastVarianceAvgDays} />
          <EnterpriseKpi label="Active forecasts" value={f.activeForecastCount} />
          <EnterpriseKpi label="Planning vs active drift" value={f.planningVsActiveVarianceAvgDays} />
          <EnterpriseKpi label="Behind active forecast" value={f.tasksBehindActiveForecast} warn={f.tasksBehindActiveForecast > 0} />
          <EnterpriseKpi label="Tasks on track" value={f.tasksOnTrack} />
          <EnterpriseKpi label="Tasks missing estimates" value={f.tasksMissingEstimates} warn={f.tasksMissingEstimates > 0} />
          <EnterpriseKpi label="Projects missing estimates" value={f.projectsMissingEstimates} warn={f.projectsMissingEstimates > 0} />
          <EnterpriseKpi label="Tasks at risk" value={f.tasksAtRisk} warn={f.tasksAtRisk > 0} />
          <EnterpriseKpi label="Projects at risk" value={f.projectsAtRisk} warn={f.projectsAtRisk > 0} />
        </div>
        {f.byDepartment.length > 0 && (
          <EnterpriseDataTable>
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTh>Department</EnterpriseTh>
                <EnterpriseTh align="right">Active tasks</EnterpriseTh>
                <EnterpriseTh align="right">Est. hours</EnterpriseTh>
                <EnterpriseTh align="right">At risk</EnterpriseTh>
              </tr>
            </EnterpriseTableHead>
            <tbody>
              {f.byDepartment.map((d) => (
                <tr key={d.departmentId} className="enterprise-row-hover">
                  <EnterpriseTd>{d.departmentName}</EnterpriseTd>
                  <EnterpriseTd align="right">{d.activeTasks}</EnterpriseTd>
                  <EnterpriseTd align="right">{d.estimatedHours}h</EnterpriseTd>
                  <EnterpriseTd align="right">{d.atRisk}</EnterpriseTd>
                </tr>
              ))}
            </tbody>
          </EnterpriseDataTable>
        )}
        {f.atRiskTasks.length > 0 && (
          <div className="mt-4">
            <p className="enterprise-label mb-2">At-risk tasks</p>
            <EnterpriseDataTable compact>
              <EnterpriseTableHead>
                <tr>
                  <EnterpriseTh>Task</EnterpriseTh>
                  <EnterpriseTh>Assignee</EnterpriseTh>
                  <EnterpriseTh>Manual due</EnterpriseTh>
                  <EnterpriseTh>Suggested</EnterpriseTh>
                  <EnterpriseTh>Status</EnterpriseTh>
                </tr>
              </EnterpriseTableHead>
              <tbody>
                {f.atRiskTasks.map((t) => (
                  <tr key={t.id} className="enterprise-row-hover">
                    <EnterpriseTd className="font-medium">
                      <Link
                        href={operationsHref({ package: t.id })}
                        className="text-primary hover:underline"
                        title="Open task in operations"
                      >
                        {t.title}
                      </Link>
                    </EnterpriseTd>
                    <EnterpriseTd>{t.employeeName}</EnterpriseTd>
                    <EnterpriseTd>{t.manualDueDate ?? "—"}</EnterpriseTd>
                    <EnterpriseTd>{t.suggestedDueDate ?? "—"}</EnterpriseTd>
                    <EnterpriseTd><DueDateStatusBadge status={t.status} /></EnterpriseTd>
                  </tr>
                ))}
              </tbody>
            </EnterpriseDataTable>
          </div>
        )}
      </EnterpriseSection>

      <EnterpriseSection
        title="Workload alerts"
        description="Employees with low or no assigned work, capacity gaps, and alert response metrics"
      >
        {(() => {
          const w = metrics.workloadAlerts;
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                <EnterpriseKpi label="Open alerts" value={w.openAlerts} warn={w.openAlerts > 0} href="/alert-center" title="Open Alert Center" />
                <EnterpriseKpi label="Low workload" value={w.lowWorkloadCount} warn={w.lowWorkloadCount > 0} href="/alert-center#workload-alerts" />
                <EnterpriseKpi label="No assigned work" value={w.noWorkCount} warn={w.noWorkCount > 0} href="/alert-center#workload-alerts" />
                <EnterpriseKpi
                  label="Avg unused capacity"
                  value={`${w.avgUnusedCapacityHours}h`}
                />
                <EnterpriseKpi label="Avg response time" value={`${w.avgResponseTimeHours}h`} />
              </div>
              {w.byDepartment.length > 0 && (
                <EnterpriseDataTable compact>
                  <EnterpriseTableHead>
                    <tr>
                      <EnterpriseTh>Department</EnterpriseTh>
                      <EnterpriseTh align="right">Alerts</EnterpriseTh>
                      <EnterpriseTh align="right">Critical</EnterpriseTh>
                    </tr>
                  </EnterpriseTableHead>
                  <tbody>
                    {w.byDepartment.map((d) => (
                      <tr key={d.departmentId} className="enterprise-row-hover">
                        <EnterpriseTd>{d.departmentName}</EnterpriseTd>
                        <EnterpriseTd align="right">{d.alertCount}</EnterpriseTd>
                        <EnterpriseTd align="right">{d.criticalCount}</EnterpriseTd>
                      </tr>
                    ))}
                  </tbody>
                </EnterpriseDataTable>
              )}
              {w.repeatedLowWorkload.length > 0 && (
                <div className="mt-4">
                  <p className="enterprise-label mb-2">Repeated low-workload employees (30d)</p>
                  <EnterpriseDataTable compact>
                    <EnterpriseTableHead>
                      <tr>
                        <EnterpriseTh>Employee</EnterpriseTh>
                        <EnterpriseTh align="right">Alert events</EnterpriseTh>
                      </tr>
                    </EnterpriseTableHead>
                    <tbody>
                      {w.repeatedLowWorkload.map((r) => (
                        <tr key={r.userId} className="enterprise-row-hover">
                          <EnterpriseTd>{r.name}</EnterpriseTd>
                          <EnterpriseTd align="right">{r.alertCount}</EnterpriseTd>
                        </tr>
                      ))}
                    </tbody>
                  </EnterpriseDataTable>
                </div>
              )}
            </>
          );
        })()}
      </EnterpriseSection>

      <EnterpriseSection
        title="Help requests"
        description="Employee help flags, response times, and repeated blockers"
      >
        {(() => {
          const h = metrics.helpFlags;
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                <EnterpriseKpi label="Total requests" value={h.totalRequests} />
                <EnterpriseKpi label="Unresolved" value={h.unresolvedCount} warn={h.unresolvedCount > 0} />
                <EnterpriseKpi label="Avg response" value={`${h.avgResponseTimeMinutes}m`} />
                <EnterpriseKpi label="Avg resolution" value={`${h.avgResolutionTimeMinutes}m`} />
              </div>
              {h.byDepartment.length > 0 && (
                <EnterpriseDataTable compact>
                  <EnterpriseTableHead>
                    <tr>
                      <EnterpriseTh>Department</EnterpriseTh>
                      <EnterpriseTh align="right">Requests</EnterpriseTh>
                    </tr>
                  </EnterpriseTableHead>
                  <tbody>
                    {h.byDepartment.map((d) => (
                      <tr key={d.departmentId} className="enterprise-row-hover">
                        <EnterpriseTd>{d.departmentName}</EnterpriseTd>
                        <EnterpriseTd align="right">{d.count}</EnterpriseTd>
                      </tr>
                    ))}
                  </tbody>
                </EnterpriseDataTable>
              )}
              {h.byReason.length > 0 && (
                <div className="mt-4">
                  <p className="enterprise-label mb-2">By reason</p>
                  <EnterpriseDataTable compact>
                    <EnterpriseTableHead>
                      <tr>
                        <EnterpriseTh>Reason</EnterpriseTh>
                        <EnterpriseTh align="right">Count</EnterpriseTh>
                      </tr>
                    </EnterpriseTableHead>
                    <tbody>
                      {h.byReason.map((r) => (
                        <tr key={r.reason} className="enterprise-row-hover">
                          <EnterpriseTd>{HELP_FLAG_REASON_LABELS[r.reason]}</EnterpriseTd>
                          <EnterpriseTd align="right">{r.count}</EnterpriseTd>
                        </tr>
                      ))}
                    </tbody>
                  </EnterpriseDataTable>
                </div>
              )}
              {h.repeatedBlockers.length > 0 && (
                <div className="mt-4">
                  <p className="enterprise-label mb-2">Repeated blockers (30d)</p>
                  <EnterpriseDataTable compact>
                    <EnterpriseTableHead>
                      <tr>
                        <EnterpriseTh>Employee</EnterpriseTh>
                        <EnterpriseTh align="right">Requests</EnterpriseTh>
                      </tr>
                    </EnterpriseTableHead>
                    <tbody>
                      {h.repeatedBlockers.map((r) => (
                        <tr key={r.userId} className="enterprise-row-hover">
                          <EnterpriseTd>{r.name}</EnterpriseTd>
                          <EnterpriseTd align="right">{r.count}</EnterpriseTd>
                        </tr>
                      ))}
                    </tbody>
                  </EnterpriseDataTable>
                </div>
              )}
            </>
          );
        })()}
      </EnterpriseSection>

      <EnterpriseSection title="Completion by Period">
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Period</EnterpriseTh>
              <EnterpriseTh align="right">Completed</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {metrics.completedByPeriod.map((p) => (
              <tr key={p.period} className="enterprise-row-hover">
                <EnterpriseTd>{p.period}</EnterpriseTd>
                <EnterpriseTd align="right">{p.count}</EnterpriseTd>
              </tr>
            ))}
            <tr className="enterprise-row-hover">
              <EnterpriseTd>Blocked Work</EnterpriseTd>
              <EnterpriseTd align="right">{metrics.stuckCount}</EnterpriseTd>
            </tr>
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <EnterpriseSection title="Productivity by Analyst">
          <div className="enterprise-panel p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.productivityByAnalyst} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="completed" fill="var(--chart-1)" radius={[0, 2, 2, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </EnterpriseSection>

        <EnterpriseSection title="Performance Trend">
          <div className="enterprise-panel p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics.performanceTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="flowScore" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </EnterpriseSection>
      </div>

      <EnterpriseSection title="Workload by Analyst">
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Analyst</EnterpriseTh>
              <EnterpriseTh align="right">Active Packages</EnterpriseTh>
              <EnterpriseTh align="right">Hours Logged</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {metrics.workloadByAnalyst.map((a) => (
              <tr key={a.name} className="enterprise-row-hover">
                <EnterpriseTd>{a.name}</EnterpriseTd>
                <EnterpriseTd align="right">{a.active}</EnterpriseTd>
                <EnterpriseTd align="right">{a.hours}</EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>
    </div>
  );
}
