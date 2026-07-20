"use client";

import { useMemo, useState } from "react";
import { GamificationPanel } from "@/components/accountability/gamification-panel";
import { Button } from "@/components/ui/button";
import type { EmployeeScorecard, User } from "@/types/flow";
import type { BadgeState } from "@/lib/badges/badge-types";

/**
 * Leaderboard with P1 scope default: viewers with a team see THEIR team's
 * board first, with a one-click switch to the company-wide board. Competition
 * stays visible; the default just stops being everyone-by-default.
 */
export function ScopedLeaderboard({
  scorecards,
  badgesByUser = {},
  leads = [],
  viewerTeamId = null,
  teams = [],
}: {
  scorecards: EmployeeScorecard[];
  badgesByUser?: Record<string, BadgeState[]>;
  leads?: { user: User; badges: BadgeState[] }[];
  viewerTeamId?: string | null;
  teams?: { id: string; name: string }[];
}) {
  const teamHasPlayers = useMemo(
    () => Boolean(viewerTeamId) && scorecards.some((s) => s.user.team_id === viewerTeamId),
    [scorecards, viewerTeamId]
  );
  const [scope, setScope] = useState<"team" | "all">(teamHasPlayers ? "team" : "all");

  const teamName =
    (viewerTeamId && teams.find((t) => t.id === viewerTeamId)?.name) || "My team";

  const shown = useMemo(() => {
    if (scope === "all" || !viewerTeamId) return { scorecards, leads };
    return {
      scorecards: scorecards.filter((s) => s.user.team_id === viewerTeamId),
      leads: leads.filter((l) => l.user.team_id === viewerTeamId),
    };
  }, [scope, viewerTeamId, scorecards, leads]);

  return (
    <div className="space-y-4">
      {teamHasPlayers && (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={scope === "team" ? "secondary" : "ghost"}
            onClick={() => setScope("team")}
          >
            {teamName}
          </Button>
          <Button
            size="sm"
            variant={scope === "all" ? "secondary" : "ghost"}
            onClick={() => setScope("all")}
          >
            Everyone
          </Button>
        </div>
      )}
      <GamificationPanel
        scorecards={shown.scorecards}
        badgesByUser={badgesByUser}
        leads={shown.leads}
      />
    </div>
  );
}
