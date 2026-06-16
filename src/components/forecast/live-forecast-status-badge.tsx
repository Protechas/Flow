import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LIVE_FORECAST_STATUS_CLASS,
  LIVE_FORECAST_STATUS_LABELS,
} from "@/lib/forecast/constants";
import type { LiveForecastStatus } from "@/types/flow";

export function LiveForecastStatusBadge({
  status,
  className,
}: {
  status?: LiveForecastStatus | null;
  className?: string;
}) {
  if (!status) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium uppercase tracking-wide",
        LIVE_FORECAST_STATUS_CLASS[status],
        className
      )}
    >
      {LIVE_FORECAST_STATUS_LABELS[status]}
    </Badge>
  );
}
