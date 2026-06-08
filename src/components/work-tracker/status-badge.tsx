import { Badge } from "@/components/ui/badge";
import { statusColor, statusDotColor, statusLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkStatus } from "@/types/flow";

export function StatusBadge({
  status,
  showDot = true,
  size = "default",
}: {
  status: WorkStatus;
  showDot?: boolean;
  size?: "default" | "sm";
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium gap-1.5 max-w-full rounded-sm",
        size === "sm" && "text-[10px] px-1.5 py-0 h-5",
        statusColor(status)
      )}
    >
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotColor(status))}
          aria-hidden
        />
      )}
      {statusLabel(status)}
    </Badge>
  );
}
