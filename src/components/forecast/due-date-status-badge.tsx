import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DUE_DATE_STATUS_LABELS } from "@/lib/forecast/constants";
import type { DueDateStatus } from "@/types/flow";

const STATUS_CLASS: Record<DueDateStatus, string> = {
  on_track: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
  at_risk: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  behind_capacity: "border-red-500/30 text-red-400 bg-red-500/5",
  needs_review: "border-border text-muted-foreground",
  no_forecast: "border-border text-muted-foreground",
};

export function DueDateStatusBadge({
  status,
  className,
}: {
  status?: DueDateStatus | null;
  className?: string;
}) {
  const s = status ?? "no_forecast";
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium uppercase tracking-wide", STATUS_CLASS[s], className)}
    >
      {DUE_DATE_STATUS_LABELS[s]}
    </Badge>
  );
}
