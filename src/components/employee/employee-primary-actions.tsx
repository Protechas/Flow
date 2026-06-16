"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNextTaskAction } from "@/app/actions/employee";
import { clockInAction, clockOutAction } from "@/app/actions/clock";
import { recordWrapUpBlockAttemptAction } from "@/app/actions/wrap-up";
import { resumeTaskTimerAction } from "@/app/actions/production";
import { HelpFlagDialog } from "@/components/help-flags/help-flag-dialog";
import { EmployeeWrapUp } from "@/components/employee/employee-wrap-up";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getEmployeeClockStatus } from "@/lib/time-clock/labels";
import { cn } from "@/lib/utils";
import type {
  DailyWrapUp,
  TaskTimeEntry,
  TimeClockEntry,
  WorkPackage,
  WrapUpComplianceStatus,
} from "@/types/flow";
import {
  FileUp,
  LogIn,
  LogOut,
  Moon,
  Play,
  RotateCcw,
} from "lucide-react";

function ActionTile({
  label,
  icon: Icon,
  disabled,
  onClick,
  href,
  variant = "default",
  type = "button",
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "primary" | "warn";
  type?: "button" | "submit";
}) {
  const className = cn(
    "flow-employee-action-tile w-full min-w-0",
    variant === "primary" && "flow-employee-action-tile-primary",
    variant === "warn" && "flow-employee-action-tile-warn",
    disabled && "opacity-45 pointer-events-none"
  );

  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-xs font-medium leading-tight">{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} className={className} disabled={disabled} onClick={onClick}>
      {inner}
    </button>
  );
}

export function EmployeePrimaryActions({
  currentTask,
  nextTask,
  activeTaskTimer,
  useShiftClock,
  activeClock,
  todayClockEntries,
  wrapUpStatus,
  todayWrapUp,
}: {
  currentTask: WorkPackage | null;
  nextTask: WorkPackage | null;
  activeTaskTimer: TaskTimeEntry | null;
  useShiftClock: boolean;
  activeClock: TimeClockEntry | null;
  todayClockEntries: TimeClockEntry[];
  wrapUpStatus: WrapUpComplianceStatus;
  todayWrapUp: DailyWrapUp | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState(false);
  const [clockError, setClockError] = useState<string | null>(null);

  const clockState = getEmployeeClockStatus(activeClock, todayClockEntries);
  const onShift = clockState === "on_shift";
  const taskForActions = currentTask ?? nextTask;
  const timerPaused = activeTaskTimer?.status === "paused";
  const timerActive = activeTaskTimer?.status === "active";
  const wrapUpComplete = wrapUpStatus === "submitted" || wrapUpStatus === "overridden";
  const canStart = (!!nextTask || !!currentTask) && !(timerActive && !!currentTask);

  function performClockOut() {
    setClockError(null);
    startTransition(async () => {
      try {
        await clockOutAction("out");
        setConfirmOpen(false);
        setPendingClockOut(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Clock out failed";
        if (msg === "WRAP_UP_REQUIRED") {
          setConfirmOpen(false);
          setGateOpen(true);
          setPendingClockOut(true);
        } else {
          setClockError(msg);
        }
      }
    });
  }

  function handleClockOutClick() {
    setClockError(null);
    if (wrapUpComplete) {
      performClockOut();
      return;
    }
    setPendingClockOut(true);
    startTransition(async () => {
      await recordWrapUpBlockAttemptAction();
    });
    setGateOpen(true);
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <form action={startNextTaskAction} className="min-w-0">
          <ActionTile
            label="Start Task"
            icon={Play}
            variant="primary"
            type="submit"
            disabled={pending || !canStart}
          />
        </form>

        {timerPaused && currentTask ? (
          <ActionTile
            label="Resume Task"
            icon={RotateCcw}
            variant="primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await resumeTaskTimerAction();
                router.refresh();
              })
            }
          />
        ) : (
          <ActionTile
            label="Resume Task"
            icon={RotateCcw}
            href={currentTask ? `/work/${currentTask.id}` : undefined}
            disabled={!currentTask}
          />
        )}

        <ActionTile
          label="Upload Files"
          icon={FileUp}
          href={taskForActions ? `/work/${taskForActions.id}` : undefined}
          disabled={!taskForActions}
        />

        <div className="min-w-0">
          <HelpFlagDialog
            taskId={currentTask?.id ?? nextTask?.id}
            source="dashboard"
            triggerLabel="Need Help"
            tile
            onSubmitted={() => router.refresh()}
          />
        </div>

        <ActionTile
          label="Submit Wrap-Up"
          icon={Moon}
          disabled={wrapUpComplete}
          onClick={() => setWrapUpOpen(true)}
        />

        {useShiftClock && (
          <>
            <ActionTile
              label="Clock In"
              icon={LogIn}
              disabled={pending || onShift}
              onClick={() => startTransition(() => clockInAction())}
            />
            <ActionTile
              label="Clock Out"
              icon={LogOut}
              variant="warn"
              disabled={pending || !onShift}
              onClick={handleClockOutClick}
            />
          </>
        )}
      </div>

      {clockError && <p className="text-xs text-red-400 mt-2">{clockError}</p>}

      <EmployeeWrapUp
        existing={todayWrapUp}
        open={wrapUpOpen}
        onOpenChange={setWrapUpOpen}
        showTrigger={false}
        onSubmitted={() => {
          router.refresh();
          if (pendingClockOut) {
            setConfirmOpen(true);
          }
        }}
      />

      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wrap-up required</DialogTitle>
            <DialogDescription>
              Complete your end-of-day wrap-up before clocking out.
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
              Complete wrap-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wrap-up saved</DialogTitle>
            <DialogDescription>You can clock out when ready.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Stay clocked in
            </Button>
            <Button disabled={pending} onClick={performClockOut}>
              Clock out now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
