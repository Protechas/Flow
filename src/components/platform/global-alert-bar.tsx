import { cn } from "@/lib/utils";
import { ActiveStatusIndicator } from "@/components/platform/active-status-indicator";
import type { ReactNode } from "react";

export function GlobalAlertBar({
  children,
  variant = "info",
  action,
  className,
  pulse = false,
}: {
  children: ReactNode;
  variant?: "healthy" | "info" | "warn" | "danger";
  action?: ReactNode;
  className?: string;
  /** Subtle emphasis for critical operational alerts */
  pulse?: boolean;
}) {
  return (
    <div
      className={cn(
        "flow-platform-alert-bar flow-alert-strip flex flex-wrap items-center justify-between gap-3 px-4 py-3",
        variant === "healthy" && "flow-alert-strip-healthy",
        variant === "warn" && "flow-alert-strip-attention border-amber-500/30",
        variant === "danger" && "flow-alert-strip-critical",
        variant === "info" && "border-border/60 bg-muted/10",
        pulse && variant === "danger" && "flow-kpi-card-critical",
        className
      )}
      role="status"
    >
      <div className="text-sm text-muted-foreground min-w-0 flex items-center gap-2">
        {pulse && variant === "danger" && (
          <ActiveStatusIndicator status="critical" live title="Critical alert" />
        )}
        <span>{children}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
