"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export interface TeamTabEntry {
  id: string;
  name: string;
  count: number;
}

/**
 * Team lanes for the Projects portfolio. "All teams" is the default and is
 * exactly the pre-tabs view — selecting a team scopes the whole portfolio
 * (cards, stats, wizards) to that team's lane. Each team runs its lane its
 * own way via per-project templates and tracking flags; this is the door.
 */
export function TeamTabs({ teams }: { teams: TeamTabEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("team") ?? "all";

  if (teams.length <= 1) return null;

  function select(teamId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (teamId === "all") params.delete("team");
    else params.set("team", teamId);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <Button
        variant={current === "all" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => select("all")}
      >
        All teams
      </Button>
      {teams.map((t) => (
        <Button
          key={t.id}
          variant={current === t.id ? "secondary" : "ghost"}
          size="sm"
          onClick={() => select(t.id)}
        >
          <Users className="mr-1.5 h-3.5 w-3.5" />
          {t.name}
          <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span>
        </Button>
      ))}
    </div>
  );
}
