import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmployeeScorecard, User } from "@/types/flow";
import type { BadgeState, BadgeTier } from "@/lib/badges/badge-types";
import { frameClassName } from "@/lib/badges/cosmetic-types";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { userDisplayInitials } from "@/lib/users/format";
import {
  Award,
  CheckCircle2,
  File,
  Files,
  Flame,
  Lightbulb,
  Rocket,
  Shield,
  Sparkles,
  Sunrise,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file: File,
  files: Files,
  trophy: Trophy,
  flame: Flame,
  sunrise: Sunrise,
  check: CheckCircle2,
  sparkles: Sparkles,
  timer: Timer,
  lightbulb: Lightbulb,
  rocket: Rocket,
  shield: Shield,
  zap: Zap,
};

const TIER_STYLES: Record<BadgeTier, string> = {
  bronze: "border-amber-700/50 bg-amber-700/10 text-amber-600",
  silver: "border-slate-400/50 bg-slate-400/10 text-slate-300",
  gold: "border-yellow-500/60 bg-yellow-500/10 text-yellow-500",
  platinum: "border-cyan-400/60 bg-cyan-400/10 text-cyan-300",
};

export function GamificationPanel({
  scorecards,
  badgesByUser = {},
  leads = [],
}: {
  scorecards: EmployeeScorecard[];
  badgesByUser?: Record<string, BadgeState[]>;
  /** Team leads & reviewers — they earn badges too (Gatekeeper, The Wall, …). */
  leads?: { user: User; badges: BadgeState[] }[];
}) {
  const earnedCount = (userId: string) =>
    (badgesByUser[userId] ?? []).filter((b) => b.earned).length;

  const ranked = [...scorecards].sort(
    // Flow Score rules the board; badges break ties.
    (a, b) => b.flowScore - a.flowScore || earnedCount(b.user.id) - earnedCount(a.user.id)
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          Leaderboard
          <InfoTooltip helpKey="leaderboardRanking" />
        </h2>
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
              {ranked.map((s, i) => {
                const badges = badgesByUser[s.user.id] ?? [];
                const earned = badges.filter((b) => b.earned);
                return (
                  <tr key={s.user.id} className="border-t border-border/40">
                    <td className="py-3 px-4 font-bold text-primary">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground",
                            frameClassName(s.user.avatar_frame)
                          )}
                        >
                          {userDisplayInitials(s.user)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{s.user.full_name}</p>
                          {s.user.flair_title && (
                            <p className="text-[10px] text-primary">{s.user.flair_title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">{s.flowScore}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {earned.slice(0, 5).map((b) => {
                          const Icon = ICONS[b.icon] ?? Award;
                          return (
                            <span
                              key={b.id}
                              title={`${b.name} — ${b.description}`}
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full border",
                                TIER_STYLES[b.tier]
                              )}
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                          );
                        })}
                        <span className="ml-1 font-semibold tabular-nums">{earned.length}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Ranked by Flow Score; badge count breaks ties. Badges are earned automatically from real
          work — frames and titles are cosmetics employees unlock and choose themselves.
        </p>
      </section>

      {leads.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Leads &amp; reviewers</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leads
              .sort(
                (a, b) =>
                  b.badges.filter((x) => x.earned).length -
                  a.badges.filter((x) => x.earned).length
              )
              .map(({ user, badges }) => {
                const earned = badges.filter((b) => b.earned);
                return (
                  <Card key={user.id} className="border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2.5 text-sm">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground",
                            frameClassName(user.avatar_frame)
                          )}
                        >
                          {userDisplayInitials(user)}
                        </div>
                        <span className="min-w-0">
                          {user.full_name}
                          {user.flair_title && (
                            <span className="block text-[10px] font-normal text-primary">
                              {user.flair_title}
                            </span>
                          )}
                        </span>
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
                          {earned.length} earned
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {earned.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Nothing yet — first review earns Gatekeeper.
                        </p>
                      ) : (
                        earned.map((b) => {
                          const Icon = ICONS[b.icon] ?? Award;
                          return (
                            <Badge
                              key={b.id}
                              variant="outline"
                              className={cn("gap-1 py-1", TIER_STYLES[b.tier])}
                              title={b.description}
                            >
                              <Icon className="h-3 w-3" />
                              {b.name}
                            </Badge>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Badge showcase</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ranked.map((s) => {
            const earned = (badgesByUser[s.user.id] ?? []).filter((b) => b.earned);
            return (
              <Card key={s.user.id} className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    {s.user.full_name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {earned.length} earned
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {earned.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing yet — first badge soon.</p>
                  ) : (
                    earned.map((b) => {
                      const Icon = ICONS[b.icon] ?? Award;
                      return (
                        <Badge
                          key={b.id}
                          variant="outline"
                          className={cn("gap-1 py-1", TIER_STYLES[b.tier])}
                          title={b.description}
                        >
                          <Icon className="h-3 w-3" />
                          {b.name}
                        </Badge>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
