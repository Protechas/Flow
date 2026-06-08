import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmployeeScorecard, FlowBadge } from "@/types/flow";
import {
  Activity,
  Award,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Zap,
  Award,
  CheckCircle2,
  Activity,
};

export function GamificationPanel({ scorecards }: { scorecards: EmployeeScorecard[] }) {
  const earned = scorecards.flatMap((s) =>
    s.badges.filter((b) => b.earned).map((b) => ({ ...b, userName: s.user.full_name, userId: s.user.id }))
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left py-3 px-4">Rank</th>
                <th className="text-left py-3 px-4">Employee</th>
                <th className="text-right py-3 px-4">Flow Score</th>
                <th className="text-right py-3 px-4">Badges</th>
              </tr>
            </thead>
            <tbody>
              {scorecards
                .sort((a, b) => b.flowScore - a.flowScore)
                .map((s, i) => (
                  <tr key={s.user.id} className="border-t border-border/40">
                    <td className="py-3 px-4 font-bold text-violet-400">{i + 1}</td>
                    <td className="py-3 px-4 font-medium">{s.user.full_name}</td>
                    <td className="py-3 px-4 text-right font-semibold">{s.flowScore}</td>
                    <td className="py-3 px-4 text-right">
                      {s.badges.filter((b) => b.earned).length}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Badges & achievements</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scorecards.map((s) => (
            <Card key={s.user.id} className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{s.user.full_name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {s.badges.map((b) => (
                  <BadgeItem key={b.id} badge={b} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {earned.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {earned.length} badge(s) earned from real activity thresholds (QA, completions, overdue, engagement).
        </p>
      )}
    </div>
  );
}

function BadgeItem({ badge }: { badge: FlowBadge }) {
  const Icon = ICONS[badge.icon] ?? Award;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 py-1",
        badge.earned
          ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
          : "opacity-40"
      )}
      title={badge.earned ? badge.earnedReason : badge.description}
    >
      <Icon className="h-3 w-3" />
      {badge.name}
    </Badge>
  );
}
