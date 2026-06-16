import Link from "next/link";
import { TrendBadge } from "@/components/ui/trend-badge";
import { cn } from "@/lib/utils";

export function EnterpriseKpi({
  label,
  value,
  href,
  sublabel,
  trend,
  warn,
  spotlight,
  className,
}: {
  label: string;
  value: string | number;
  href?: string;
  sublabel?: string;
  /** Optional trend delta for executive KPI presentation */
  trend?: { delta: number; label?: string };
  warn?: boolean;
  spotlight?: boolean;
  className?: string;
}) {
  const inner = (
    <div
      className={cn(
        "flow-kpi-card px-4 py-3.5 min-w-0",
        warn && "flow-kpi-card-warn",
        href && "flow-kpi-card-interactive cursor-pointer",
        className
      )}
    >
      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-2">
          <p className="enterprise-label truncate">{label}</p>
          {!warn && spotlight !== false && <span className="flow-kpi-accent-corner" aria-hidden />}
        </div>
        <p className={cn("flow-metric-lg mt-1.5", warn && "text-warning")}>{value}</p>
        {trend && (
          <div className="mt-1.5 flex items-center gap-2">
            <TrendBadge
              trend={trend.delta > 0 ? "up" : trend.delta < 0 ? "down" : "neutral"}
              label={trend.label ?? `${trend.delta >= 0 ? "↑" : "↓"} ${Math.abs(trend.delta)}`}
            />
          </div>
        )}
        {sublabel && !trend && <p className="flow-meta mt-1 truncate">{sublabel}</p>}
        {sublabel && trend && <p className="flow-meta mt-0.5 truncate">{sublabel}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0">
        {inner}
      </Link>
    );
  }
  return inner;
}
