"use client";

import { useState, useTransition } from "react";
import { raiseHelpFlagAction } from "@/app/actions/help-flags";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";
import type { HelpFlagReason } from "@/types/flow";
import { LifeBuoy } from "lucide-react";

const REASONS = Object.entries(HELP_FLAG_REASON_LABELS) as [HelpFlagReason, string][];

export function HelpFlagDialog({
  taskId,
  source,
  triggerLabel = "Need help",
  onSubmitted,
  tile,
}: {
  taskId?: string;
  source: "task" | "dashboard" | "timer" | "wrap_up";
  triggerLabel?: string;
  onSubmitted?: () => void;
  /** Match employee workspace action tile styling */
  tile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<HelpFlagReason>("stuck_on_task");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {tile ? (
        <DialogTrigger
          render={
            <button
              type="button"
              className="flow-employee-action-tile flow-employee-action-tile-warn w-full min-w-0"
            />
          }
        >
          <LifeBuoy className="h-5 w-5 shrink-0" />
          <span className="text-xs font-medium leading-tight">{triggerLabel}</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="border-warning/40 text-warning hover:bg-warning/10"
            />
          }
        >
          <LifeBuoy className="h-4 w-4 mr-1.5" />
          {triggerLabel}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Flag for help</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const res = await raiseHelpFlagAction({
                reason,
                notes: (fd.get("notes") as string) || undefined,
                taskId,
                source,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              onSubmitted?.();
            });
          }}
        >
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as HelpFlagReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="help-notes">Notes (optional)</Label>
            <Textarea
              id="help-notes"
              name="notes"
              rows={3}
              placeholder="What do you need help with?"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Your team lead and manager will be notified immediately.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Submit help request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
