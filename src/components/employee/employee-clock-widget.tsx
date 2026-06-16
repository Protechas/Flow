"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockInAction, clockOutAction } from "@/app/actions/clock";
import { recordWrapUpBlockAttemptAction } from "@/app/actions/wrap-up";
import { EmployeeWrapUpForm } from "@/components/employee/employee-wrap-up-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMinutes } from "@/lib/production/metrics";
import {
  clockStatusLabel,
  getEmployeeClockStatus,
} from "@/lib/time-clock/labels";
import type { TimeClockEntry, WrapUpComplianceStatus } from "@/types/flow";
import { Clock, Coffee, LogIn, LogOut, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmployeeClockWidget({
  activeEntry,
  todayEntries,
  shiftMinutesToday,
  wrapUpStatus,
}: {
  activeEntry: TimeClockEntry | null;
  todayEntries: TimeClockEntry[];
  shiftMinutesToday: number;
  wrapUpStatus: WrapUpComplianceStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gateOpen, setGateOpen] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clockState = getEmployeeClockStatus(activeEntry, todayEntries);
  const statusLabel = clockStatusLabel(activeEntry, todayEntries);
  const onShift = clockState === "on_shift";
  const onLunch = clockState === "on_lunch";
  const wrapUpComplete = wrapUpStatus === "submitted" || wrapUpStatus === "overridden";

  function performClockOut() {
    setError(null);
    startTransition(async () => {
      try {
        await clockOutAction("out");
        setConfirmOpen(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Clock out failed";
        if (msg === "WRAP_UP_REQUIRED") {
          setConfirmOpen(false);
          setGateOpen(true);
        } else {
          setError(msg);
        }
      }
    });
  }

  function handleEndOfDayClick() {
    setError(null);
    if (wrapUpComplete) {
      performClockOut();
      return;
    }
    startTransition(async () => {
      await recordWrapUpBlockAttemptAction();
    });
    setGateOpen(true);
  }

  return (
    <>
      <div
        className={cn(
          "enterprise-panel p-4 sm:p-5",
          onShift && "border-emerald-500/25 bg-emerald-500/5",
          onLunch && "border-amber-500/25 bg-amber-500/5"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                onShift && "bg-emerald-500/20 text-emerald-400",
                onLunch && "bg-amber-500/20 text-amber-400",
                !onShift && !onLunch && "bg-muted text-muted-foreground"
              )}
            >
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="enterprise-label">Shift clock</p>
              <p className="text-sm font-semibold mt-0.5">{statusLabel}</p>
              {onShift && activeEntry && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Since{" "}
                  {new Date(activeEntry.clock_in_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {formatMinutes(shiftMinutesToday)} worked today
                </p>
              )}
              {onLunch && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clock in when you return · {formatMinutes(shiftMinutesToday)} worked today
                </p>
              )}
              {!onShift && !onLunch && shiftMinutesToday > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatMinutes(shiftMinutesToday)} worked today
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {onShift ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => startTransition(() => clockOutAction("lunch"))}
                >
                  <Coffee className="h-4 w-4 mr-1.5" />
                  Lunch
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={handleEndOfDayClick}
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Out
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => startTransition(() => clockInAction())}
              >
                <LogIn className="h-4 w-4 mr-1.5" />
                Clock in
              </Button>
            )}
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-3">{error}</p>
        )}
      </div>

      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary mb-1">
              <Moon className="h-5 w-5" />
            </div>
            <DialogTitle>End of Day Wrap-Up Required</DialogTitle>
            <DialogDescription>
              Please complete your end-of-day wrap-up before clocking out. This helps your team
              stay aligned on daily progress and blockers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setGateOpen(false)}>
              Not yet
            </Button>
            <Button
              onClick={() => {
                setGateOpen(false);
                setWrapUpOpen(true);
              }}
            >
              Complete Wrap-Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wrapUpOpen} onOpenChange={setWrapUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How was your day?</DialogTitle>
            <DialogDescription>
              Complete your wrap-up to finish your shift.
            </DialogDescription>
          </DialogHeader>
          <EmployeeWrapUpForm
            submitLabel="Save & continue"
            onSubmitted={() => {
              setWrapUpOpen(false);
              setConfirmOpen(true);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wrap-up saved</DialogTitle>
            <DialogDescription>
              Your end-of-day wrap-up is on file. You can clock out whenever you&apos;re ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Stay clocked in
            </Button>
            <Button disabled={pending} onClick={performClockOut}>
              <LogOut className="h-4 w-4 mr-1.5" />
              {pending ? "Clocking out…" : "Clock out now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
