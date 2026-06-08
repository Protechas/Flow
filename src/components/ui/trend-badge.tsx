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
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        trend === "up" && "bg-emerald-500/15 text-emerald-400",
        trend === "down" && "bg-red-500/15 text-red-400",
        trend === "neutral" && "bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
