import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
  highlight?: boolean;
  warn?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
  highlight,
  warn,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flow-kpi-card px-4 py-3 relative",
        warn && "flow-kpi-card-warn",
        highlight && "border-[var(--border-accent)]",
        className
      )}
    >
      <div className="relative z-[1]">
        <div className="flex items-center justify-between gap-2">
          <p className="enterprise-label">{title}</p>
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </div>
        <p className={cn("flow-metric-lg mt-1.5", warn && "text-warning")}>{value}</p>
        {subtitle && <p className="flow-meta mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
