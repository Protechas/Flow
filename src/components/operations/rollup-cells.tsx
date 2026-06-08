import type { RollupMetrics } from "@/types/flow";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";

export function formatLastActivity(at: string | null | undefined): string {
  if (!at) return "—";
  try {
    return formatDistanceToNow(parseISO(at), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Parent row rollup columns: Est | Act | Files | QA | Corr | Done% | Last Activity */
export function RollupCells({ r, compact }: { r: RollupMetrics; compact?: boolean }) {
  return (
    <>
      <td className={cn("text-right tabular-nums text-xs text-muted-foreground", compact && "text-muted-foreground")}>
        {r.estimatedHours}h
      </td>
      <td className="text-right tabular-nums text-xs text-muted-foreground">{r.hoursLogged}h</td>
      <td className="text-right tabular-nums text-xs text-muted-foreground">{r.fileCount}</td>
      <td className="text-right tabular-nums text-xs text-muted-foreground">{r.qaPassRate}%</td>
      <td className="text-right tabular-nums text-xs text-muted-foreground">{r.correctionCount}</td>
      <td className={cn("text-right tabular-nums text-xs", compact && "text-muted-foreground")}>
        {r.completedPct}%
      </td>
      <td className="text-right text-xs text-muted-foreground whitespace-nowrap">
        {formatLastActivity(r.lastActivityAt)}
      </td>
    </>
  );
}
