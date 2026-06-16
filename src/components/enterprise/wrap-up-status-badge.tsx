import { cn } from "@/lib/utils";
import type { WrapUpComplianceStatus } from "@/types/flow";

const STATUS_STYLES: Record<
  WrapUpComplianceStatus,
  { label: string; className: string }
> = {
  submitted: {
    label: "Submitted",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  },
  missing: {
    label: "Missing",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  },
  overridden: {
    label: "Overridden",
    className: "border-sky-500/25 bg-sky-500/10 text-sky-400",
  },
};

export function WrapUpStatusBadge({
  status,
  className,
}: {
  status: WrapUpComplianceStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
