"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clockInAction, clockOutAction } from "@/app/actions/clock";
import { startQueueTaskAction, switchToTaskAction } from "@/app/actions/employee";
import { requestWorkAction } from "@/app/actions/employee-workflow";
import { recordWrapUpBlockAttemptAction } from "@/app/actions/wrap-up";
import { pauseTaskTimerAction, resumeTaskTimerAction } from "@/app/actions/production";
import { EmployeeWrapUp } from "@/components/employee/employee-wrap-up";
import { useEmployeeWorkflow } from "@/components/employee/employee-workflow-context";
import { WorkEligibilityGateDialog } from "@/components/employee/work-eligibility-gate-dialog";
import { HelpFlagDialog } from "@/components/help-flags/help-flag-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatActionError } from "@/lib/errors/action-messages";
import { navigateToTaskWorkspace } from "@/lib/employee/task-navigation";
import { cn } from "@/lib/utils";
import type { DailyWrapUp } from "@/types/flow";
import { AlertCircle, Check, Circle, Coffee, HandHelping, LogIn, LogOut, Play } from "lucide-react";

const ACCENT_STYLES = {
  neutral: "border-border/50 bg-muted/5",
  success: "border-emerald-500/40 bg-emerald-500/8",
  warning: "border-amber-500/40 bg-amber-500/8",
  danger: "border-red-500/40 bg-red-500/8",
} as const;

const DOT_STYLES = {
  neutral: "bg-muted-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

export function EmployeeWorkflowPanel({
  todayWrapUp,
  visibility,
  wrapUpOpen,
  onWrapUpOpenChange,
}: {
  todayWrapUp: DailyWrapUp | null;
  visibility?: {
    clockedMinutes: number;
    recordedTaskMinutes: number;
    unassignedMinutes: number;
    taskTrackingCompliancePct: number | null;
  };
  wrapUpOpen: boolean;
  onWrapUpOpenChange: (open: boolean) => void;
}) {
  const wf = useEmployeeWorkflow();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gateOpen, setGateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [requestWorkOpen, setRequestWorkOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ attempted: string; active: string | null } | null>(
    null
  );
  const [wrapUpGateOpen, setWrapUpGateOpen] = useState(false);
  const [confirmClockOutOpen, setConfirmClockOutOpen] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState(false);
  const [activeTaskDialogOpen, setActiveTaskDialogOpen] = useState(false);

  function startTask(taskId: string) {
    if (!wf.workEligible) {
      setGateOpen(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await startQueueTaskAction(taskId);
      if (!res.ok) {
        if (res.code === "ACTIVE_TASK_CONFLICT") {
          setConflict({ attempted: taskId, active: res.activeTaskId ?? wf.activeTaskId });
          return;
        }
        setError(res.message ?? "Could not start task");
        return;
      }
      navigateToTaskWorkspace(router, res.taskId, { autostart: true });
    });
  }

  function continueToActiveTask() {
    const taskId = wf.activeTaskId;
    if (!taskId) return;

    if (wf.missionMode === "paused") {
      setError(null);
      startTransition(async () => {
        const res = await resumeTaskTimerAction();
        if (!res.ok && "message" in res && res.message) {
          setError(res.message);
          return;
        }
        navigateToTaskWorkspace(router, taskId);
      });
      return;
    }

    navigateToTaskWorkspace(router, taskId);
  }

  function handleRequestWork() {
    setError(null);
    startTransition(async () => {
      const res = await requestWorkAction(requestNote);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRequestWorkOpen(false);
      setRequestNote("");
      router.refresh();
    });
  }

  function performClockOut() {
    setError(null);
    startTransition(async () => {
      try {
        await clockOutAction("out");
        setConfirmClockOutOpen(false);
        setPendingClockOut(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Clock out failed";
        if (msg === "WRAP_UP_REQUIRED") {
          setWrapUpGateOpen(true);
          setPendingClockOut(true);
        } else {
          setError(msg);
        }
      }
    });
  }

  function proceedToClockOut() {
    if (wf.wrapUpComplete) {
      performClockOut();
      return;
    }
    setPendingClockOut(true);
    startTransition(async () => {
      await recordWrapUpBlockAttemptAction();
    });
    setWrapUpGateOpen(true);
  }

  function handleClockOutClick() {
    setError(null);
    // Only a RUNNING timer interrupts clock-out; a paused timer already saved
    // its progress (and the server force-stops any timer on clock-out anyway).
    if (wf.clockOutBlockedByTask) {
      setActiveTaskDialogOpen(true);
      return;
    }
    proceedToClockOut();
  }

  function pauseAndClockOut() {
    setActiveTaskDialogOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        await pauseTaskTimerAction();
      } catch (e) {
        setError(formatActionError(e));
        return;
      }
      proceedToClockOut();
    });
  }

  return (
    <>
      <section
        className={cn(
          "enterprise-panel-elevated border-2 p-4 sm:p-5 space-y-5",
          ACCENT_STYLES[wf.statusAccent]
        )}
      >
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Current Status
          </p>
          <div className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full shrink-0", DOT_STYLES[wf.statusAccent])} aria-hidden />
            <h2 className="text-lg sm:text-xl font-bold">{wf.statusTitle}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{wf.statusDescription}</p>
        </div>

        {/* A single blocker repeats what Your Next Step already says — only
            list blockers separately when there are several to enumerate */}
        {wf.blockers.length > 1 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Blocked By
            </p>
            <ul className="space-y-1">
              {wf.blockers.map((b) => (
                <li key={b.id} className="text-xs flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  {b.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {wf.steps.map((step) => (
            <li
              key={step.id}
              className={cn(
                "rounded-lg border px-2 py-2 text-[10px] sm:text-xs leading-tight",
                step.state === "complete" && "border-emerald-500/30 bg-emerald-500/5",
                step.state === "current" && "border-primary/40 bg-primary/5",
                step.state === "blocked" && "border-border/40 opacity-60",
                step.state === "upcoming" && "border-border/40 text-muted-foreground"
              )}
            >
              <div className="flex items-start gap-1.5">
                {step.state === "complete" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 mt-0.5",
                      step.state === "current" ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                )}
                <span className="font-medium">{step.label}</span>
              </div>
            </li>
          ))}
        </ol>

        <div
          className={cn(
            "rounded-lg border px-4 py-3 space-y-1",
            wf.blockers.length > 0
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border/50 bg-muted/10"
          )}
        >
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              wf.blockers.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-primary"
            )}
          >
            Your Next Step
          </p>
          <p className="font-semibold text-sm">{wf.nextStepTitle}</p>
          <p className="text-xs text-muted-foreground">{wf.nextStepDescription}</p>
        </div>

        {wf.showNoTaskPanel && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-3">
            <p className="text-sm font-medium">
              {wf.missionMode === "staged"
                ? "Your task is assigned but the timer is not running."
                : "You are clocked in with no active task."}
            </p>
            <div className="flex flex-wrap gap-2">
              {wf.actions.requestWork && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setRequestWorkOpen(true)}>
                  Request Work
                </Button>
              )}
              {wf.actions.requestHelp && (
                <Button size="sm" variant="outline" onClick={() => setHelpOpen(true)}>
                  <HandHelping className="h-4 w-4 mr-1.5" />
                  Request Assistance
                </Button>
              )}
            </div>
            {wf.showNoAssignedWork && !wf.pendingWorkRequest && (
              <p className="text-xs text-muted-foreground">
                No assigned work is currently available. Request Work notifies your team lead.
              </p>
            )}
            {wf.pendingWorkRequest && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Your work request has been sent. Your team lead has been notified.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {wf.actions.clockIn && (
            <Button
              size="lg"
              className="h-12 text-base font-semibold flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await clockInAction();
                    router.refresh();
                  } catch (e) {
                    setError(formatActionError(e));
                  }
                })
              }
            >
              <LogIn className="h-5 w-5 mr-2" />
              {wf.state === "ON_LUNCH" ? "Back from Break" : "Clock In"}
            </Button>
          )}

          {wf.actions.continueTask && wf.activeTaskId && (
            <Button
              size="lg"
              className="h-12 text-base font-semibold flex-1"
              disabled={pending}
              onClick={continueToActiveTask}
            >
              <Play className="h-5 w-5 mr-2" />
              {wf.missionMode === "paused" ? "Resume Work" : "Continue Work"}
            </Button>
          )}

          {wf.missionMode === "staged" && wf.missionTask && !wf.actions.continueTask && (
            <Button
              size="lg"
              className="h-12 text-base font-semibold flex-1"
              disabled={pending}
              onClick={() => startTask(wf.missionTask!.id)}
            >
              <Play className="h-5 w-5 mr-2" />
              Start Task Timer
            </Button>
          )}

          {wf.actions.startTask && wf.nextTaskId && !wf.actions.continueTask && (
            <Button
              size="lg"
              className="h-12 text-base font-semibold flex-1"
              disabled={pending}
              onClick={() => startTask(wf.nextTaskId!)}
            >
              <Play className="h-5 w-5 mr-2" />
              Start Assigned Task
            </Button>
          )}

          {wf.useShiftClock && wf.actions.clockOutLunch && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                disabled={pending}
                title="Clock out for a break — take as many as your day needs"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await clockOutAction("lunch");
                      router.refresh();
                    } catch (e) {
                      setError(formatActionError(e));
                    }
                  })
                }
              >
                <Coffee className="h-4 w-4 mr-1.5" />
                Break / Lunch
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 border-red-500/30 text-red-400 hover:bg-red-500/10"
                disabled={pending}
                onClick={handleClockOutClick}
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Clock Out
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {wf.actions.completeDailyReport && (
            <Button size="sm" variant="outline" onClick={() => onWrapUpOpenChange(true)}>
              Complete Daily Report
            </Button>
          )}
          {wf.actions.requestHelp && (
            <Button size="sm" variant="ghost" onClick={() => setHelpOpen(true)}>
              Need Help
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      <EmployeeWrapUp
        existing={todayWrapUp}
        open={wrapUpOpen}
        onOpenChange={onWrapUpOpenChange}
        showTrigger={false}
        visibility={visibility}
        onSubmitted={() => {
          router.refresh();
          if (pendingClockOut) setConfirmClockOutOpen(true);
        }}
      />

      <WorkEligibilityGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        message="You must be clocked in before starting work."
        onClockedIn={() => router.refresh()}
      />

      <HelpFlagDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        hideTrigger
        taskId={wf.uploadTaskId ?? undefined}
        source="dashboard"
        onSubmitted={() => router.refresh()}
      />

      <Dialog open={requestWorkOpen} onOpenChange={setRequestWorkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Work</DialogTitle>
            <DialogDescription>
              Notify your team lead that you are available for additional assignments.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Optional note for your manager…"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestWorkOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={handleRequestWork}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch tasks?</DialogTitle>
            <DialogDescription>
              You already have a task in progress. Switching saves your current session — every
              minute and file is kept — and the task moves to the top of Up Next so you can come
              back to it anytime. No need to clock out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConflict(null)}>
              Cancel
            </Button>
            {conflict?.active && (
              <Button
                variant="outline"
                render={<Link href={`/work/${conflict.active}`} />}
              >
                View current task
              </Button>
            )}
            {conflict && (
              <Button
                disabled={pending}
                onClick={() => {
                  const target = conflict.attempted;
                  startTransition(async () => {
                    const res = await switchToTaskAction(target);
                    if (!res.ok) {
                      setError(res.message ?? "Could not switch tasks");
                      setConflict(null);
                      return;
                    }
                    setConflict(null);
                    navigateToTaskWorkspace(router, target);
                  });
                }}
              >
                Switch &amp; start
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeTaskDialogOpen} onOpenChange={setActiveTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Task timer still running</DialogTitle>
            <DialogDescription>
              Your task timer is running. Pause it and clock out in one step, or open the task to
              submit your work first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setActiveTaskDialogOpen(false)}>
              Stay clocked in
            </Button>
            {wf.activeTaskId && (
              <Button
                variant="secondary"
                render={<Link href={`/work/${wf.activeTaskId}`} />}
              >
                Open task
              </Button>
            )}
            <Button disabled={pending} onClick={pauseAndClockOut}>
              Pause &amp; clock out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wrapUpGateOpen} onOpenChange={setWrapUpGateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Daily report required</DialogTitle>
            <DialogDescription>
              Complete your end-of-day report before clocking out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setWrapUpGateOpen(false)}>
              Not yet
            </Button>
            <Button
              onClick={() => {
                setWrapUpGateOpen(false);
                onWrapUpOpenChange(true);
              }}
            >
              Complete daily report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClockOutOpen} onOpenChange={setConfirmClockOutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Daily report saved</DialogTitle>
            <DialogDescription>You can clock out when ready.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClockOutOpen(false)}>
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
