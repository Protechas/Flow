import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

interface TrendBadgeProps {
  trend: "up" | "down" | "neutral";
  label?: string;
  className?: string;
}

export function TrendBadge({ trend, label, className }: TrendBadgeProps) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        trend === "up" && "flow-status-success",
        trend === "down" && "flow-status-danger",
        trend === "neutral" && "bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
