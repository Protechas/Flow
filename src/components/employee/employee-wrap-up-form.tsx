"use client";

import { useEffect, useState, useTransition } from "react";
import { getWrapUpDraftAction, submitDailyWrapUpAction } from "@/app/actions/employee";
import { WorkDaySummaryPanel } from "@/components/work-visibility/work-day-summary-panel";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const ACTIVITY_CATEGORIES = [
  { value: "meeting", label: "Meeting" },
  { value: "training", label: "Training" },
  { value: "research", label: "Research" },
  { value: "supervisor_request", label: "Supervisor request" },
  { value: "qa_review", label: "QA review" },
  { value: "administrative", label: "Administrative work" },
  { value: "system_issue", label: "System issue" },
  { value: "other", label: "Other" },
] as const;

export function EmployeeWrapUpForm({
  onSubmitted,
  submitLabel = "Save wrap-up",
  visibility,
}: {
  onSubmitted?: () => void;
  submitLabel?: string;
  visibility?: {
    clockedMinutes: number;
    recordedTaskMinutes: number;
    unassignedMinutes: number;
    taskTrackingCompliancePct: number | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [needsSupport, setNeedsSupport] = useState(false);
  const [showActivityDoc, setShowActivityDoc] = useState(false);
  const [activityCategory, setActivityCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState("");
  const [draftApplied, setDraftApplied] = useState(false);

  // Pre-fill from today's tracked activity so nobody reconstructs their day
  // from memory. Only applies while the field is still untouched.
  useEffect(() => {
    let cancelled = false;
    getWrapUpDraftAction()
      .then((draft) => {
        if (cancelled || !draft.hasActivity) return;
        setCompleted((current) => {
          if (current.trim().length > 0) return current;
          setDraftApplied(true);
          return draft.summary;
        });
      })
      .catch(() => {
        // Draft is a convenience — the form works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasUnassigned = (visibility?.unassignedMinutes ?? 0) > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          setError(null);
          try {
            const res = await submitDailyWrapUpAction({
              completed_summary: (fd.get("completed") as string) ?? "",
              blockers: (fd.get("blockers") as string) ?? "",
              needs_support: needsSupport,
              needs_support_note: needsSupport
                ? ((fd.get("support_note") as string) ?? "")
                : undefined,
              activity_documentation_category:
                hasUnassigned && showActivityDoc ? activityCategory : undefined,
              activity_documentation_note:
                hasUnassigned && showActivityDoc
                  ? ((fd.get("activity_note") as string) ?? "")
                  : undefined,
            });
            if (!res.ok) {
              setError("message" in res && res.message ? res.message : "Could not save your daily report. Please try again.");
              return;
            }
            onSubmitted?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save your daily report.");
          }
        });
      }}
    >
      {visibility && (
        <WorkDaySummaryPanel
          clockedMinutes={visibility.clockedMinutes}
          recordedTaskMinutes={visibility.recordedTaskMinutes}
          unassignedMinutes={visibility.unassignedMinutes}
          taskTrackingCompliancePct={visibility.taskTrackingCompliancePct}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="completed">What did you complete today?</Label>
        <Textarea
          id="completed"
          name="completed"
          rows={draftApplied ? 5 : 3}
          placeholder="Summarize your wins…"
          value={completed}
          onChange={(e) => setCompleted(e.target.value)}
        />
        {draftApplied && (
          <p className="text-xs text-primary">
            ✦ Pre-filled from your tracked work today — edit or add anything Flow missed.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="blockers">Any blockers?</Label>
        <Textarea id="blockers" name="blockers" rows={2} placeholder="What slowed you down?" />
        <p className="text-xs text-muted-foreground">
          Blockers or support requests notify your team lead automatically.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={needsSupport} onCheckedChange={(v) => setNeedsSupport(!!v)} />
        I need manager support
      </label>
      {needsSupport && (
        <Textarea name="support_note" rows={2} placeholder="What do you need help with?" />
      )}

      {hasUnassigned && (
        <div className="space-y-3 rounded-lg border border-border/50 p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showActivityDoc}
              onCheckedChange={(v) => setShowActivityDoc(!!v)}
            />
            Document non-task activity (optional)
          </label>
          {showActivityDoc && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Activity type</Label>
                <Select value={activityCategory} onValueChange={(v) => v && setActivityCategory(v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                name="activity_note"
                rows={2}
                placeholder="Brief description of activity during unassigned time…"
              />
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
