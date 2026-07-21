"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitWeeklyUpdateAction } from "@/app/actions/weekly-update";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WeeklyUpdateWindowState } from "@/lib/wrap-up/weekly-update";
import type { EmployeeWeeklyUpdate } from "@/types/flow";
import { CalendarClock, CheckCircle2, PenLine } from "lucide-react";

/**
 * Weekly update card on the employee home (teams with weeklyUpdates enabled).
 * Shows from Thursday: pre-drafted from the week's wrap-ups; submit inside
 * the window (or after a manager reopens it).
 */
export function EmployeeWeeklyUpdateCard({
  fields,
  draft,
  existing,
  windowState,
  weekOf,
}: {
  fields: { id: string; label: string; placeholder?: string }[];
  draft: Record<string, string>;
  existing: EmployeeWeeklyUpdate | null;
  windowState: WeeklyUpdateWindowState;
  weekOf: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reopened = existing?.status === "reassigned";
  const canSubmit = windowState === "open" || reopened;
  const submitted = existing?.status === "submitted";

  if (fields.length === 0) return null;

  return (
    <section className="enterprise-panel p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Weekly update
          <span className="text-xs text-muted-foreground font-normal">week of {weekOf}</span>
        </p>
        {submitted && !open && (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submitted
          </p>
        )}
      </div>

      {reopened && (
        <p className="text-xs rounded-md border border-amber-500/25 bg-amber-500/5 p-2">
          Your manager reopened this update for revision
          {existing?.reassigned_note ? `: “${existing.reassigned_note}”` : "."}
        </p>
      )}

      {!open ? (
        <div className="flex items-center gap-3">
          <Button size="sm" variant={submitted ? "outline" : "default"} onClick={() => setOpen(true)}>
            <PenLine className="h-3.5 w-3.5 mr-1.5" />
            {submitted ? "Review / revise" : "Review draft"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {windowState === "before_open" && "Pre-filled from your daily wrap-ups. Submissions open Thursday 5:00 PM."}
            {windowState === "open" && "Due Friday 3:00 PM."}
            {windowState === "closed" && !reopened && !submitted && "Window closed Friday 3:00 PM — ask your manager to reopen it."}
            {windowState === "closed" && submitted && "Window closed — submitted for this week."}
            {reopened && "Reopened for your revision."}
          </p>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const sections: Record<string, string> = {};
            for (const f of fields) {
              const v = fd.get(`wu_${f.id}`);
              if (typeof v === "string" && v.trim()) sections[f.id] = v;
            }
            startTransition(async () => {
              setError(null);
              const res = await submitWeeklyUpdateAction({ sections });
              if (!res.ok) {
                setError(res.message ?? "Could not save your weekly update.");
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={`wu_${f.id}`} className="text-xs">
                {f.label}
              </Label>
              <Textarea
                id={`wu_${f.id}`}
                name={`wu_${f.id}`}
                rows={3}
                placeholder={f.placeholder}
                defaultValue={existing?.sections[f.id] ?? draft[f.id] ?? ""}
              />
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending || !canSubmit}>
              {pending ? "Saving…" : submitted || reopened ? "Resubmit" : "Submit weekly update"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {!canSubmit && (
              <p className="text-xs text-muted-foreground">
                {windowState === "before_open"
                  ? "Submit unlocks Thursday 5:00 PM — your edits here aren't saved until then."
                  : "Window closed — ask your manager to reopen it."}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
