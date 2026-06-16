"use client";

import type { HelpFlagView } from "@/types/flow";
import { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, LifeBuoy } from "lucide-react";

const STATUS_STYLES: Record<
  string,
  { label: string; border: string; badge: string }
> = {
  open: {
    label: "Open",
    border: "border-warning/40",
    badge: "bg-warning/15 text-warning",
  },
  acknowledged: {
    label: "Acknowledged",
    border: "border-info/40",
    badge: "bg-info/15 text-info",
  },
  in_progress: {
    label: "In progress",
    border: "border-info/40",
    badge: "bg-info/15 text-info",
  },
  resolved: {
    label: "Resolved",
    border: "border-primary/30",
    badge: "bg-primary/15 text-primary",
  },
  dismissed: {
    label: "Dismissed",
    border: "border-border/60",
    badge: "bg-muted text-muted-foreground",
  },
};

export function HelpFlagStatusList({ flags }: { flags: HelpFlagView[] }) {
  const active = flags.filter((f) =>
    ["open", "acknowledged", "in_progress"].includes(f.status)
  );
  const recent = flags.filter((f) =>
    ["resolved", "dismissed"].includes(f.status)
  ).slice(0, 3);

  if (!active.length && !recent.length) return null;

  return (
    <div className="space-y-3">
      {active.map((flag) => (
        <HelpFlagStatusCard key={flag.id} flag={flag} />
      ))}
      {recent.map((flag) => (
        <HelpFlagStatusCard key={flag.id} flag={flag} muted />
      ))}
    </div>
  );
}

function HelpFlagStatusCard({
  flag,
  muted,
}: {
  flag: HelpFlagView;
  muted?: boolean;
}) {
  const styles = STATUS_STYLES[flag.status] ?? STATUS_STYLES.open;
  const isCritical = flag.severity === "critical" && flag.status === "open";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        isCritical ? "border-destructive/40 bg-destructive/5" : styles.border,
        muted && "opacity-75"
      )}
    >
      <div className="flex items-start gap-2">
        {flag.status === "resolved" ? (
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        ) : (
          <LifeBuoy className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", styles.badge)}>
              {styles.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {HELP_FLAG_REASON_LABELS[flag.reason]}
            </span>
            {isCritical && (
              <span className="text-xs font-medium text-destructive">Critical</span>
            )}
          </div>
          {flag.task_title && (
            <p className="mt-1 font-medium truncate">{flag.task_title}</p>
          )}
          {flag.notes && (
            <p className="text-muted-foreground mt-1">{flag.notes}</p>
          )}
          {flag.acknowledged_by_name && (
            <p className="text-xs mt-2 flex items-center gap-1 text-info">
              <Clock className="h-3 w-3" />
              Acknowledged by {flag.acknowledged_by_name}
            </p>
          )}
          {flag.resolution_notes && (
            <p className="text-xs mt-1 text-primary">
              Resolution: {flag.resolution_notes}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Submitted {new Date(flag.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
