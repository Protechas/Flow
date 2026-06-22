import { OPS_COPY } from "@/lib/copy/executive-terminology";
import Link from "next/link";
import { ActiveStatusIndicator, type ActiveStatus } from "@/components/platform/active-status-indicator";
import { cn } from "@/lib/utils";

export type PostureSignal = {
  id: string;
  label: string;
  value: string | number;
  status: ActiveStatus;
  href?: string;
  title?: string;
};

export function OperationalPostureStrip({
  signals,
  title = OPS_COPY.currentOperationsStatus,
  className,
}: {
  signals: PostureSignal[];
  title?: string;
  className?: string;
}) {
  if (!signals.length) return null;

  return (
    <div className={cn("flow-operational-posture-strip flow-glass-bar", className)} role="region" aria-label={title}>
      <p className="w-full enterprise-label mb-1 opacity-80">{title}</p>
      {signals.map((signal) => {
        const chip = (
          <>
            <ActiveStatusIndicator
              status={signal.status}
              live={signal.status === "active" || signal.status === "critical"}
              title={signal.title ?? signal.label}
            />
            <span className="text-muted-foreground">{signal.label}</span>
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
