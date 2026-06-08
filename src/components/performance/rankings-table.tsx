import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { EmployeeRanking } from "@/types/flow";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function RankingsTable({ rankings }: { rankings: EmployeeRanking[] }) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 text-xs text-muted-foreground">
            <th className="text-left py-3 px-4 font-medium w-12">#</th>
            <th className="text-left py-3 px-4 font-medium">Employee</th>
            <th className="text-right py-3 px-4 font-medium">Flow Score</th>
            <th className="text-right py-3 px-4 font-medium">Action pts</th>
            <th className="text-right py-3 px-4 font-medium">Week</th>
            <th className="text-right py-3 px-4 font-medium">QA %</th>
            <th className="text-right py-3 px-4 font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((r) => (
            <tr key={r.userId} className="border-t border-border/40 hover:bg-muted/20">
              <td className="py-3 px-4 font-bold text-violet-400">{r.rank}</td>
              <td className="py-3 px-4">
                <Link href={`/people/${r.userId}`} className="font-medium hover:text-violet-400">
                  {r.name}
                </Link>
              </td>
              <td className="py-3 px-4 text-right font-semibold tabular-nums">{r.flowScore}</td>
              <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{r.actionPoints}</td>
              <td className="py-3 px-4 text-right tabular-nums">{r.completedThisWeek}</td>
              <td className="py-3 px-4 text-right tabular-nums">{r.qaPassRate}%</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    r.trendDelta >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {r.trendDelta >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {r.trendDelta >= 0 ? "+" : ""}
                  {r.trendDelta}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
