"use client";

import { useState } from "react";
import { EmployeeWrapUpForm } from "@/components/employee/employee-wrap-up-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DailyWrapUp } from "@/types/flow";
import { Moon } from "lucide-react";

export function EmployeeWrapUp({
  existing,
  open: controlledOpen,
  onOpenChange,
  onSubmitted,
  showTrigger = true,
}: {
  existing: DailyWrapUp | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmitted?: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  if (existing && !open) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
        <p className="font-medium flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" />
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
      {showTrigger && (
        <DialogTrigger>
          <Button variant="outline" className="w-full h-11 text-sm">
            <Moon className="h-4 w-4 mr-2" />
            End of day wrap-up
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your day?</DialogTitle>
        </DialogHeader>
        <EmployeeWrapUpForm
          submitLabel="Save wrap-up"
          onSubmitted={() => {
            setOpen(false);
            onSubmitted?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
