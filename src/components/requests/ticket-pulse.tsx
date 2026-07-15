"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TicketPulseData {
  open: number;
  oldestMinutes: number | null;
}

function oldestLabel(minutes: number): string {
  return minutes >= 90 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
}

/**
 * Compact email-team request indicator. Home page shows it always (habit
 * building); the task workspace shows it only when work is waiting so deep
 * focus isn't cluttered by a zero state.
 */
export function TicketPulse({
  pulse,
  showWhenEmpty = false,
  className,
}: {
  pulse: TicketPulseData;
  showWhenEmpty?: boolean;
  className?: string;
}) {
  if (pulse.open === 0 && !showWhenEmpty) return null;
  const hot = pulse.open > 0;

  return (
    <Link
      href="/work/requests"
      prefetch={false}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors",
        hot
          ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15"
          : "border-border/60 bg-card/60 hover:bg-muted/30",
        className
      )}
    >
      <Inbox className={cn("h-5 w-5 shrink-0", hot ? "text-amber-400" : "text-muted-foreground")} />
      <span className="min-w-0">
        <span className="block text-xs font-medium">Email team requests</span>
        <span
          className={cn(
            "block text-[11px]",
            hot ? "text-amber-400 font-medium" : "text-muted-foreground"
          )}
        >
          {hot
            ? `${pulse.open} waiting${
                pulse.oldestMinutes != null ? ` · oldest ${oldestLabel(pulse.oldestMinutes)}` : ""
              } — first to claim it owns it`
            : "None waiting — all caught up"}
        </span>
      </span>
      <span
        className={cn(
          "ml-1 text-xl font-semibold tabular-nums",
          hot ? "text-amber-400" : "text-muted-foreground"
        )}
      >
        {pulse.open}
      </span>
    </Link>
  );
}
