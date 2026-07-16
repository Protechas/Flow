import type { AiUsageSummary } from "@/lib/ai/usage";
import { Sparkles } from "lucide-react";

function featureLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function money(n: number): string {
  return n < 1 ? `${Math.round(n * 100)}¢` : `$${n.toFixed(2)}`;
}

/** Eddy's cost vs the manual minutes he replaces — every line an assumption on display. */
export function AiUsagePanel({ summary }: { summary: AiUsageSummary }) {
  const hoursSaved = summary.totalMinutesSaved / 60;
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Eddy — AI spend vs time returned
        </h2>
        <p className="text-xs text-muted-foreground">
          Every AI call is metered. Spend uses list token pricing; minutes saved are
          conservative per-call assumptions (shown per feature), not measurements.
        </p>
      </div>
      <div className="enterprise-panel p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total AI spend
            </p>
            <p className="text-xl font-semibold tabular-nums">{money(summary.totalSpend)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              AI calls
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {summary.totalCalls.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Est. hours returned
            </p>
            <p className="text-xl font-semibold tabular-nums">{hoursSaved.toFixed(1)}h</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                <th className="py-1.5 pr-3 font-medium">Feature</th>
                <th className="py-1.5 pr-3 font-medium text-right">Calls</th>
                <th className="py-1.5 pr-3 font-medium text-right">Spend</th>
                <th className="py-1.5 font-medium text-right">Est. minutes saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {summary.byFeature.map((row) => (
                <tr key={row.feature}>
                  <td className="py-1.5 pr-3">{featureLabel(row.feature)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.calls}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{money(row.spend)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.minutesSaved.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
