import { OPS_COPY } from "@/lib/copy/executive-terminology";
import Link from "next/link";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ActiveStatusIndicator, type ActiveStatus } from "@/components/platform/active-status-indicator";
import type { HelpTextKey } from "@/lib/help/help-text";
import { cn } from "@/lib/utils";

export type PostureSignal = {
  id: string;
  label: string;
  value: string | number;
  status: ActiveStatus;
  href?: string;
  title?: string;
  helpKey?: HelpTextKey;
};

export function OperationalPostureStrip({
  signals,
  title = OPS_COPY.currentOperationsStatus,
  className,
  helpKey = "operationsOverview",
}: {
  signals: PostureSignal[];
  title?: string;
  className?: string;
  helpKey?: HelpTextKey;
}) {
  if (!signals.length) return null;

  return (
    <div className={cn("flow-operational-posture-strip flow-glass-bar", className)} role="region" aria-label={title}>
      <p className="w-full enterprise-label mb-1 opacity-80 flex items-center gap-1">
        {title}
        <InfoTooltip helpKey={helpKey} />
      </p>
      {signals.map((signal) => {
        const chip = (
          <>
            <ActiveStatusIndicator
              status={signal.status}
              live={signal.status === "active" || signal.status === "critical"}
            />
            <span className="text-muted-foreground inline-flex items-center gap-0.5">
              {signal.label}
              <InfoTooltip helpKey={signal.helpKey} content={signal.title} />
            </span>
            <span className="font-semibold tabular-nums text-foreground">{signal.value}</span>
          </>
        );

        const statusAttr =
          signal.status === "critical"
            ? "critical"
            : signal.status === "attention"
              ? "attention"
              : signal.status === "healthy" || signal.status === "active"
                ? "healthy"
                : undefined;

        if (signal.href) {
          return (
            <Link
              key={signal.id}
              href={signal.href}
              className="flow-posture-chip"
              data-status={statusAttr}
              title={signal.title ?? signal.label}
            >
              {chip}
            </Link>
          );
        }

        return (
          <span
            key={signal.id}
            className="flow-posture-chip"
            data-status={statusAttr}
            title={signal.title}
          >
            {chip}
          </span>
        );
      })}
    </div>
  );
}
