"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endSideSessionAction, startSideSessionAction } from "@/app/actions/clock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SideSession, SideSessionCategory } from "@/types/flow";
import { GraduationCap, Loader2, Undo2, UsersRound } from "lucide-react";

const CATEGORY_LABELS: Record<SideSessionCategory, string> = {
  meeting: "Meeting",
  training: "Training",
};

function elapsedMinutes(startedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
}

/**
 * One-off tracked time (meetings, workday training). Starting a session pauses
 * the task timer; ending it resumes work. Every minute is attributed and
 * visible to leads — that transparency is the abuse guard, not friction.
 */
export function SideSessionCard({
  initialSession,
  todayMinutes,
  canStart,
}: {
  initialSession: SideSession | null;
  todayMinutes: number;
  canStart: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, forceTick] = useState(0);

  // Keep the elapsed counter honest while a session runs.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [session]);

  const start = (category: SideSessionCategory) => {
    setError(null);
    startTransition(async () => {
      const res = await startSideSessionAction(category);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSession(res.session);
      router.refresh();
    });
  };

  const end = () => {
    setError(null);
    startTransition(async () => {
      const res = await endSideSessionAction();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSession(null);
      router.refresh();
    });
  };

  if (session) {
    return (
      <div className="enterprise-panel border-amber-500/40 bg-amber-500/8 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              In {CATEGORY_LABELS[session.category].toLowerCase()} — {elapsedMinutes(session.started_at)}m
            </p>
            <p className="text-xs text-muted-foreground">
              Your task timer is paused. Ending the session resumes it.
            </p>
          </div>
          <Button size="sm" disabled={pending} onClick={end}>
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-1.5 h-4 w-4" />
            )}
            End & back to work
          </Button>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="enterprise-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">One-off time</p>
          <p className="text-xs text-muted-foreground">
            Meetings and training — pauses your task timer, tracked and visible to your lead.
            {todayMinutes > 0 ? ` ${todayMinutes}m logged today.` : ""}
          </p>
        </div>
        <div className={cn("flex gap-2", !canStart && "opacity-50")}>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !canStart}
            onClick={() => start("meeting")}
            title={canStart ? "Start a tracked meeting" : "Clock in first"}
          >
            <UsersRound className="mr-1.5 h-4 w-4" />
            Meeting
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !canStart}
            onClick={() => start("training")}
            title={canStart ? "Start tracked training time" : "Clock in first"}
          >
            <GraduationCap className="mr-1.5 h-4 w-4" />
            Training
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}
