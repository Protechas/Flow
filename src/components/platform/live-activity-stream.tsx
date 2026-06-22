import { ActivityFeed } from "@/components/enterprise/activity-feed";
import { OperationalPulse } from "@/components/platform/operational-pulse";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types/flow";
import type { ReactNode } from "react";

export function LiveActivityStream({
  events,
  title = "Live Activity",
  description,
  maxItems = 12,
  pulseStatus = "nominal",
  action,
  className,
  emptyTitle,
  emptyDescription,
}: {
  events: ActivityEvent[];
  title?: string;
  description?: string;
  maxItems?: number;
  pulseStatus?: "nominal" | "attention" | "critical";
  action?: ReactNode;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const hasEvents = events.length > 0;

  return (
    <section className={cn("flow-live-panel", className)} data-live={hasEvents ? "true" : undefined}>
      <div className="flow-live-panel-header flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="enterprise-section-title">{title}</h3>
            <OperationalPulse status={pulseStatus} />
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="px-4 py-2">
        <ActivityFeed
          events={events}
          maxItems={maxItems}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </div>
    </section>
  );
}
