"use client";

import { useTransition } from "react";
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

  function handleClockIn() {
    startTransition(async () => {
      await clockInAction();
      onOpenChange(false);
      onClockedIn?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
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
