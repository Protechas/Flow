import { cn } from "@/lib/utils";
import type { EmployeeClockStatus } from "@/lib/constants";

export function ClockStatusBadge({
  status,
  className,
}: {
  status: EmployeeClockStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium",
        status === "on_shift" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
        status === "on_lunch" && "border-amber-500/25 bg-amber-500/10 text-amber-400",
        status === "off_shift" && "border-border bg-muted/50 text-muted-foreground",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "on_shift" && "bg-emerald-400",
          status === "on_lunch" && "bg-amber-400",
          status === "off_shift" && "bg-muted-foreground/60"
        )}
        aria-hidden
      />
      {status === "on_shift" && "Clocked in"}
      {status === "on_lunch" && "On lunch"}
      {status === "off_shift" && "Not clocked in"}
    </span>
  );
}
