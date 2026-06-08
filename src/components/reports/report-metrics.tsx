"use client";

import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import type { ReportMetrics } from "@/types/flow";
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
  return (
    <div className="space-y-6">
      <div className="enterprise-panel px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{h.projects}</strong> projects</span>
        <span><strong className="text-foreground">{h.manufacturers}</strong> manufacturers</span>
        <span><strong className="text-foreground">{h.years}</strong> year nodes</span>
        <span><strong className="text-foreground">{h.packages}</strong> work packages</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EnterpriseKpi label="QA Pass Rate" value={`${metrics.qaPassRate}%`} />
        <EnterpriseKpi label="Total Corrections" value={metrics.totalCorrections} />
        <EnterpriseKpi label="Avg Time / Package" value={`${metrics.avgTimePerPackage}h`} />
        <EnterpriseKpi label="Overdue" value={metrics.overdueCount} warn={metrics.overdueCount > 0} />
      </div>

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
