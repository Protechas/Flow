import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { DUE_DATE_STATUS_HINTS } from "@/lib/forecast/constants";
import type { DueDateStatus } from "@/types/flow";

export function HealthIndicator({
  status,
  showHint = true,
}: {
  status?: DueDateStatus | null;
  showHint?: boolean;
}) {
  const key = status ?? "no_forecast";
  const hint = DUE_DATE_STATUS_HINTS[key];

  return (
    <span title={showHint ? hint : undefined}>
      <DueDateStatusBadge status={status} />
    </span>
  );
}
