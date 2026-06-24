import { cn } from "@/lib/utils";
import type { PayType } from "@/types/flow";
import { payTypeLabel } from "@/lib/users/pay-type";

export function PayTypeBadge({
  payType,
  className,
}: {
  payType: PayType | null | undefined;
  className?: string;
}) {
  const isHourly = (payType ?? "hourly") === "hourly";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium",
        isHourly
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-muted/50 text-muted-foreground",
        className
      )}
    >
      {payTypeLabel(payType ?? "hourly")}
    </span>
  );
}
