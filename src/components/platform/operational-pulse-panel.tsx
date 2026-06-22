import { OPS_COPY } from "@/lib/copy/executive-terminology";
import Link from "next/link";
import { OperationalPulse, type OperationalPulseStatus } from "@/components/platform/operational-pulse";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PulseMetric = {
  id: string;
  label: string;
  value: string | number;
  href?: string;
  /** Visual emphasis — drives border accent color */
  tone?: "healthy" | "neutral" | "warning" | "critical" | "qa";
  sublabel?: string;
};

export function OperationalPulsePanel({
  title = OPS_COPY.operationsOverview,
  subtitle,
  pulseStatus = "nominal",
  metrics,
  actions,
  className,
}: {
  title?: string;
  subtitle?: string;
  pulseStatus?: OperationalPulseStatus;
  metrics: PulseMetric[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("flow-operational-pulse-panel", className)}
      aria-label={title}
      data-posture={pulseStatus}
    >
      <div className="flow-operational-pulse-panel-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flow-command-title">{title}</h2>
            <OperationalPulse status={pulseStatus} />
          </div>
          {subtitle && (
            <p className="flow-command-subtitle mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="flow-operational-pulse-grid">
        {metrics.map((metric) => {
          const cell = (
            <div
              className="flow-pulse-metric"
              data-tone={metric.tone ?? "neutral"}
            >
              <p className="flow-pulse-metric-label">{metric.label}</p>
              <p className="flow-pulse-metric-value">{metric.value}</p>
              {metric.sublabel && (
                <p className="flow-pulse-metric-sublabel">{metric.sublabel}</p>
              )}
            </div>
          );

          if (metric.href) {
            return (
              <Link
                key={metric.id}
                href={metric.href}
                className="flow-pulse-metric-link"
                title={metric.label}
              >
                {cell}
              </Link>
            );
          }

          return <div key={metric.id}>{cell}</div>;
        })}
      </div>
    </section>
  );
}
