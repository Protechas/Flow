"use client";

import { ProjectMetricsExportButton } from "@/components/metrics/project-metrics-export-button";
import type { ProjectMetricExportRow } from "@/types/flow";

export function ProjectHealthExportActions({
  rows,
}: {
  rows: ProjectMetricExportRow[];
}) {
  return (
    <ProjectMetricsExportButton
      rows={rows}
      filename="flow-project-health-metrics.csv"
      label="Export metrics"
    />
  );
}
