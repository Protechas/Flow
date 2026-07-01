"use client";

import { useState, useTransition } from "react";
import { clockInAction } from "@/app/actions/clock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatActionError } from "@/lib/errors/action-messages";
import { LogIn } from "lucide-react";

export function WorkEligibilityGateDialog({
  open,
  onOpenChange,
  message,
  onClockedIn,
  allowClockIn = true,
  title = "Clock in required",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onClockedIn?: () => void;
  allowClockIn?: boolean;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClockIn() {
    setError(null);
    startTransition(async () => {
      try {
        await clockInAction();
        onOpenChange(false);
        onClockedIn?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {allowClockIn ? "Not now" : "Close"}
          </Button>
          {allowClockIn && (
            <Button onClick={handleClockIn} disabled={pending}>
              <LogIn className="h-4 w-4 mr-1.5" />
              {pending ? "Clocking in…" : "Clock in"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
