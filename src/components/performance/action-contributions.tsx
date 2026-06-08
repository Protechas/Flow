import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ActionContribution } from "@/types/flow";

export function ActionContributions({
  breakdown,
  totalPoints,
}: {
  breakdown: ActionContribution[];
  totalPoints: number;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Action contributions</CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalPoints} points from system activity (last 7 days)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
        ) : (
          breakdown.map((a) => {
            const pct = totalPoints > 0 ? Math.round((a.points / totalPoints) * 100) : 0;
            return (
              <div key={a.type} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{a.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {a.count} · {a.points} pts
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
