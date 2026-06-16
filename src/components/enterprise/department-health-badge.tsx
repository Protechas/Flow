import {
  HEALTH_LEVEL_LABELS,
  type DepartmentHealthLevel,
} from "@/lib/design/department-health";
import { HEALTH_LEVEL_VARIANTS } from "@/lib/design/status-system";
import { EnterpriseStatusBadge } from "@/components/enterprise/enterprise-status-badge";
import { cn } from "@/lib/utils";

export function DepartmentHealthBadge({
  level,
  score,
  showScore = true,
  size = "default",
  className,
}: {
  level: DepartmentHealthLevel;
  score?: number;
  showScore?: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const label =
    showScore && score !== undefined
      ? `${HEALTH_LEVEL_LABELS[level]} · ${score}`
      : HEALTH_LEVEL_LABELS[level];

  return (
    <EnterpriseStatusBadge
      label={label}
      variant={HEALTH_LEVEL_VARIANTS[level]}
      size={size}
      className={className}
    />
  );
}

export function DepartmentHealthMeter({
  score,
  level,
  className,
}: {
  score: number;
  level: DepartmentHealthLevel;
  className?: string;
}) {
  const barColor =
    level === "excellent"
      ? "bg-success"
      : level === "healthy"
        ? "bg-info"
        : level === "at_risk"
          ? "bg-warning"
          : "bg-danger";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="enterprise-label">Health</span>
        <span className="text-xs font-semibold tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 rounded-sm bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-sm transition-all", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
