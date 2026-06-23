import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { cn } from "@/lib/utils";

export type KpiItem = {
  id?: string;
  label: string;
  value: string | number;
  href?: string;
  onClick?: () => void;
  sublabel?: string;
  trend?: { delta: number; label?: string };
  warn?: boolean;
  critical?: boolean;
  spotlight?: boolean;
  priority?: "high" | "normal" | "low";
  title?: string;
  className?: string;
};

export function KpiStrip({
  items,
  columns = 4,
  className,
}: {
  items: KpiItem[];
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  if (!items.length) return null;

  const gridClass =
    columns === 6
      ? "xl:grid-cols-6 lg:grid-cols-3 sm:grid-cols-2"
      : columns === 3
        ? "lg:grid-cols-3 sm:grid-cols-2"
        : columns === 2
          ? "sm:grid-cols-2"
          : "lg:grid-cols-4 sm:grid-cols-2";

  return (
    <div className={cn("flow-glass-bar flow-kpi-glass-zone", className)}>
      <div className={cn("flow-platform-kpi-strip grid gap-3", gridClass)}>
        {items.map((item) => (
          <EnterpriseKpi
            key={item.id ?? item.label}
            label={item.label}
            value={item.value}
            href={item.href}
            onClick={item.onClick}
            sublabel={item.sublabel}
            trend={item.trend}
            warn={item.warn}
            critical={item.critical}
            spotlight={item.spotlight}
            priority={item.priority}
            title={item.title}
            className={item.className}
          />
        ))}
      </div>
    </div>
  );
}
