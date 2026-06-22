import { cn } from "@/lib/utils";

import { OPS_COPY } from "@/lib/copy/executive-terminology";

export type OperationalPulseStatus = "nominal" | "attention" | "critical";

const STATUS_LABEL: Record<OperationalPulseStatus, string> = {
  nominal: OPS_COPY.operatingNormally,
  attention: OPS_COPY.attentionRequired,
  critical: OPS_COPY.criticalItemsOpen,
};

export function OperationalPulse({
  status = "nominal",
  label,
  className,
}: {
  status?: OperationalPulseStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("flow-operational-pulse", className)}
      data-status={status}
      role="status"
    >
      <span className="flow-operational-pulse-dot" aria-hidden />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
