import { cn } from "@/lib/utils";

export type ActiveStatus = "active" | "idle" | "attention" | "critical" | "healthy";

export function ActiveStatusIndicator({
  status,
  live = false,
  className,
  title,
}: {
  status: ActiveStatus;
  live?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("flow-status-indicator", className)}
      data-status={status}
      data-live={live ? "true" : undefined}
      title={title}
      role="img"
      aria-label={title ?? status}
    />
  );
}
