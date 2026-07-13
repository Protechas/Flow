"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acknowledgeCoachingSessionAction,
  resolveCoachingSessionAction,
} from "@/app/actions/coaching";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useFlowToast } from "@/components/ui/flow-toast";
import { COACHING_CATEGORY_LABELS, COACHING_LEVEL_LABELS } from "@/lib/coaching/labels";
import { cn } from "@/lib/utils";
import type { CoachingLevel, CoachingSessionView } from "@/types/flow";
import { CheckCircle2, CircleDashed } from "lucide-react";

const LEVEL_STYLES: Record<CoachingLevel, string> = {
  coaching: "border-sky-500/30 text-sky-500",
  verbal_warning: "border-amber-500/30 text-amber-500",
  written_warning: "border-amber-500/50 text-amber-600",
  final_warning: "border-red-500/40 text-red-500",
};

function followUpDue(session: CoachingSessionView): boolean {
  return (
    session.status === "open" &&
    !!session.follow_up_date &&
    session.follow_up_date <= new Date().toISOString().slice(0, 10)
  );
}

/**
 * Coaching records list. Managers see everyone (with resolve controls);
 * employees see their own (with acknowledge).
 */
export function CoachingList({
  sessions,
  viewerId,
  canManage,
}: {
  sessions: CoachingSessionView[];
  viewerId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [resolveTarget, setResolveTarget] = useState<CoachingSessionView | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {canManage ? "No coaching sessions logged yet." : "No coaching records — keep it that way."}
      </p>
    );
  }

  const acknowledge = (id: string) =>
    startTransition(async () => {
      const res = await acknowledgeCoachingSessionAction(id);
      if (!res.ok) toast({ variant: "error", title: res.message ?? "Could not acknowledge" });
      else toast({ variant: "success", title: "Acknowledged" });
      router.refresh();
    });

  const resolve = () => {
    const target = resolveTarget;
    if (!target) return;
    setResolveTarget(null);
    startTransition(async () => {
      const res = await resolveCoachingSessionAction(target.id, resolveNote);
      if (!res.ok) toast({ variant: "error", title: res.message ?? "Could not resolve" });
      else toast({ variant: "success", title: "Follow-up resolved" });
      setResolveNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <div
          key={s.id}
          className={cn(
            "rounded-md border border-border/50 bg-muted/10 p-3 space-y-2",
            followUpDue(s) && "border-amber-500/40 bg-amber-500/5"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("shrink-0", LEVEL_STYLES[s.level])}>
              {COACHING_LEVEL_LABELS[s.level]}
            </Badge>
            <Badge variant="outline">{COACHING_CATEGORY_LABELS[s.category]}</Badge>
            {canManage && <span className="text-sm font-medium">{s.employee_name}</span>}
            <span className="text-xs text-muted-foreground">
              {s.session_date} · by {s.coach_name}
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs">
              {s.acknowledged_at ? (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Acknowledged
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <CircleDashed className="h-3.5 w-3.5" />
                  Awaiting acknowledgment
                </span>
              )}
              {s.status === "resolved" ? (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
                  Resolved
                </Badge>
              ) : followUpDue(s) ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                  Follow-up due
                </Badge>
              ) : null}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{s.summary}</p>
          {s.expectation && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Expected: </span>
              {s.expectation}
            </p>
          )}
          {s.follow_up_date && s.status === "open" && (
            <p className="text-xs text-muted-foreground">Follow-up: {s.follow_up_date}</p>
          )}
          {s.resolution_note && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Resolution: </span>
              {s.resolution_note}
            </p>
          )}
          <div className="flex gap-2">
            {!canManage && s.employee_id === viewerId && !s.acknowledged_at && (
              <Button size="sm" disabled={pending} onClick={() => acknowledge(s.id)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Acknowledge
              </Button>
            )}
            {canManage && s.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setResolveTarget(s)}
              >
                Resolve follow-up
              </Button>
            )}
          </div>
        </div>
      ))}

      <Dialog open={resolveTarget !== null} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve follow-up</DialogTitle>
            <DialogDescription>
              Close the loop: did the behavior improve? This note completes the record.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="e.g. On time every day for two weeks — resolved."
            rows={3}
            maxLength={2000}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={resolve}>
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
