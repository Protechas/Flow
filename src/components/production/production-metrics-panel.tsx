import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { formatMinutes } from "@/lib/production/metrics";
import type { ProductionMetrics } from "@/types/flow";

export function ProductionMetricsPanel({
  metrics,
  fileCount,
  className,
}: {
  metrics: ProductionMetrics;
  fileCount: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${className ?? ""}`}>
      <EnterpriseKpi label="Task time" value={formatMinutes(metrics.totalTaskMinutes)} />
      <EnterpriseKpi label="Documents" value={String(fileCount)} />
      <EnterpriseKpi
        label="Avg / document"
        value={
          metrics.averageMinutesPerDocument > 0
            ? `${metrics.averageMinutesPerDocument}m`
            : "—"
        }
      />
      <EnterpriseKpi
        label="Docs / hour"
        value={metrics.documentsPerHour > 0 ? String(metrics.documentsPerHour) : "—"}
      />
    </div>
  );
}
