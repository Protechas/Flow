"use client";

import { downloadCsv } from "@/lib/export/csv-download";
import { exportProjectMetricsCsv } from "@/lib/metrics/project-metrics-export";
import type { ProjectMetricExportRow } from "@/types/flow";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ProjectMetricsExportButton({
  rows,
  filename = "flow-project-metrics.csv",
  label = "Export metrics",
  size = "sm",
}: {
  rows: ProjectMetricExportRow[];
  filename?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  if (!rows.length) return null;

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={() => downloadCsv(filename, exportProjectMetricsCsv(rows))}
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Button>
  );
}
