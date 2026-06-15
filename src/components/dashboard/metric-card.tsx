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
        "enterprise-panel px-4 py-3",
        highlight && "border-primary/30",
        warn && "border-amber-500/40 bg-amber-500/10",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="enterprise-label">{title}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </div>
      <p className={cn("enterprise-kpi-value mt-1", warn && "text-amber-400")}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
