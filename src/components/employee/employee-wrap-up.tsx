"use client";

import { useState, useTransition } from "react";
import { submitDailyWrapUpAction } from "@/app/actions/employee";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { DailyWrapUp } from "@/types/flow";
import { Moon } from "lucide-react";

export function EmployeeWrapUp({
  existing,
}: {
  existing: DailyWrapUp | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [needsSupport, setNeedsSupport] = useState(existing?.needs_support ?? false);

  if (existing) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
        <p className="font-medium flex items-center gap-2">
          <Moon className="h-4 w-4 text-violet-400" />
          Today&apos;s wrap-up saved
        </p>
        {existing.completed_summary && (
          <p className="text-muted-foreground mt-1 text-xs">{existing.completed_summary}</p>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="w-full h-11 text-sm">
            <Moon className="h-4 w-4 mr-2" />
            End of day wrap-up
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your day?</DialogTitle>
        </DialogHeader>
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
              setOpen(false);
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
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={needsSupport}
              onCheckedChange={(v) => setNeedsSupport(!!v)}
            />
            I need manager support
          </label>
          {needsSupport && (
            <Textarea
              name="support_note"
              rows={2}
              placeholder="What do you need help with?"
            />
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              Save wrap-up
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
