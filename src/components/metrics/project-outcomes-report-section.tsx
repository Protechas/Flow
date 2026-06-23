"use client";

import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { ProjectMetricsExportButton } from "@/components/metrics/project-metrics-export-button";
import type { ExecutiveOutcomeMetric, ProjectMetricExportRow } from "@/types/flow";

export function ProjectOutcomesReportSection({
  outcomeMetrics,
  projectMetricRows,
  exportFilename = "flow-project-metrics.csv",
}: {
  outcomeMetrics: ExecutiveOutcomeMetric[];
  projectMetricRows: ProjectMetricExportRow[];
  exportFilename?: string;
}) {
  if (!outcomeMetrics.length && !projectMetricRows.length) return null;

  return (
    <EnterpriseSection
      title="Project outcomes"
      description="Custom success metrics aggregated across active projects"
      actions={
        <ProjectMetricsExportButton rows={projectMetricRows} filename={exportFilename} />
      }
    >
      {outcomeMetrics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {outcomeMetrics.map((metric) => (
            <EnterpriseKpi
              key={metric.id}
              label={metric.metric_name}
              value={metric.aggregate_value}
              sublabel={`${metric.project_count} project${metric.project_count === 1 ? "" : "s"} · ${metric.unit_label ?? "total"}`}
              title={metric.metric_name}
            />
          ))}
        </div>
      )}

      {projectMetricRows.length > 0 && (
        <EnterpriseDataTable compact>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Project</EnterpriseTh>
              <EnterpriseTh>Metric</EnterpriseTh>
              <EnterpriseTh align="right">Value</EnterpriseTh>
              <EnterpriseTh align="right">Target</EnterpriseTh>
              <EnterpriseTh align="right">7d</EnterpriseTh>
              <EnterpriseTh align="right">30d</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {projectMetricRows.map((row) => (
              <tr
                key={`${row.projectId}-${row.metricName}`}
                className="enterprise-row-hover"
              >
                <EnterpriseTd>{row.projectName}</EnterpriseTd>
                <EnterpriseTd>{row.metricName}</EnterpriseTd>
                <EnterpriseTd align="right">{row.value}</EnterpriseTd>
                <EnterpriseTd align="right">{row.target}</EnterpriseTd>
                <EnterpriseTd align="right">{row.trend7d}</EnterpriseTd>
                <EnterpriseTd align="right">{row.trend30d}</EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      )}
    </EnterpriseSection>
  );
}
