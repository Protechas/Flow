import { priorityLabel, WORK_PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkPriority } from "@/types/flow";

export function PriorityBadge({ priority }: { priority: WorkPriority }) {
  const color = WORK_PRIORITIES.find((p) => p.value === priority)?.color;
  return (
    <span className={cn("text-xs font-medium", color)}>
      {priorityLabel(priority)}
    </span>
  );
}
