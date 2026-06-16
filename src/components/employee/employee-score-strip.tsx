import Link from "next/link";
import { FlowScoreRing } from "@/components/performance/flow-score-ring";
import type { EmployeeScorecard } from "@/types/flow";

/** @deprecated Score strip is inline in EmployeeHome — kept for compatibility */
export function EmployeeScoreStrip({ scorecard }: { scorecard: EmployeeScorecard }) {
  return (
    <Link
      href="/scorecard"
      className="flex items-center gap-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 hover:border-primary/30 transition-colors mb-6"
    >
      <FlowScoreRing score={scorecard.flowScore} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Your Flow Score</p>
        <p className="text-xs text-muted-foreground truncate">
          {scorecard.actionPointsToday} pts today · {scorecard.completedThisWeek} done this week
        </p>
      </div>
      <span className="text-xs text-primary shrink-0">View →</span>
    </Link>
  );
}
