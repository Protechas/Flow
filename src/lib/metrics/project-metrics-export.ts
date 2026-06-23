import type { ProjectMetricExportRow } from "@/types/flow";

export function exportProjectMetricsCsv(rows: ProjectMetricExportRow[]): string {
  const header = [
    "Project",
    "Metric",
    "Type",
    "Value",
    "Target",
    "Previous",
    "7d Change",
    "30d Change",
    "Formula",
  ].join(",");

  const lines = rows.map((r) =>
    [
      r.projectName,
      r.metricName,
      r.metricType,
      r.value,
      r.target,
      r.previous ?? "",
      r.trend7d,
      r.trend30d,
      r.isFormula ? "Yes" : "No",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );

  return [header, ...lines].join("\n");
}
