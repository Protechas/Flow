"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BadgeState, BadgeTier } from "@/lib/badges/badge-types";
import { CustomizeDialog, type CosmeticsState } from "@/components/badges/customize-dialog";
import { cn } from "@/lib/utils";
import {
  Award,
  CheckCircle2,
  File,
  Files,
  Flame,
  Lightbulb,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  Sunrise,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";

const ICONS = {
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
} as const;

const TIER_STYLES: Record<BadgeTier, string> = {
  bronze: "border-amber-700/50 bg-amber-700/10 text-amber-600",
  silver: "border-slate-400/50 bg-slate-400/10 text-slate-300",
  gold: "border-yellow-500/60 bg-yellow-500/10 text-yellow-500",
};

function BadgeChip({ badge, size = "md" }: { badge: BadgeState; size?: "sm" | "md" }) {
  const Icon = ICONS[badge.icon] ?? Award;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border",
        size === "sm" ? "h-9 w-9" : "h-12 w-12",
        badge.earned ? TIER_STYLES[badge.tier] : "border-border/40 bg-muted/30 text-muted-foreground/40"
      )}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </div>
  );
}

export function BadgesPanel({
  badges,
  cosmetics,
}: {
  badges: BadgeState[];
  cosmetics?: CosmeticsState;
}) {
  const [open, setOpen] = useState(false);
  const earned = badges.filter((b) => b.earned);
  const next = badges
    .filter((b) => !b.earned && b.progress > 0)
    .sort((a, b) => b.progress / b.target - a.progress / a.target)[0];

  return (
    <TooltipProvider delay={200}>
      <section className="enterprise-panel p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Award className="h-3.5 w-3.5 text-primary" />
            Badges
            <span className="font-normal normal-case">
              {earned.length} of {badges.length}
            </span>
          </h2>
          <div className="flex items-center gap-1">
            {cosmetics && <CustomizeDialog badges={badges} cosmetics={cosmetics} />}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(true)}>
              View all
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {earned.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No badges yet — upload your first document to get started.
            </p>
          ) : (
            earned.map((badge) => (
              <Tooltip key={badge.id}>
                <TooltipTrigger render={<span />}>
                  <BadgeChip badge={badge} size="sm" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="font-semibold">{badge.name}</span> — {badge.description}
                </TooltipContent>
              </Tooltip>
            ))
          )}
          {next && (
            <p className="ml-1 text-xs text-muted-foreground">
              Next up: <span className="font-medium text-foreground">{next.name}</span> (
              {next.progress}/{next.target})
            </p>
          )}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Badges — {earned.length} of {badges.length} earned
            </DialogTitle>
            <DialogDescription>Earned automatically as you work. Keep going.</DialogDescription>
          </DialogHeader>
          <ul className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {badges.map((badge) => (
              <li
                key={badge.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2.5",
                  badge.earned ? "border-primary/25 bg-primary/5" : "border-border/40 opacity-70"
                )}
              >
                <BadgeChip badge={badge} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {badge.name}
                    {!badge.earned && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  {!badge.earned && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.round((badge.progress / badge.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
