"use client";

import { useState, useTransition } from "react";
import { submitDailyWrapUpAction } from "@/app/actions/employee";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export function EmployeeWrapUpForm({
  onSubmitted,
  submitLabel = "Save wrap-up",
}: {
  onSubmitted?: () => void;
  submitLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [needsSupport, setNeedsSupport] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await submitDailyWrapUpAction({
            completed_summary: (fd.get("completed") as string) ?? "",
            blockers: (fd.get("blockers") as string) ?? "",
            needs_support: needsSupport,
            needs_support_note: needsSupport
              ? ((fd.get("support_note") as string) ?? "")
              : undefined,
          });
          onSubmitted?.();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="completed">What did you complete today?</Label>
        <Textarea id="completed" name="completed" rows={3} placeholder="Summarize your wins…" />
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
      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
