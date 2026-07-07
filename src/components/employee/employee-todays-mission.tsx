"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clockInAction } from "@/app/actions/clock";
import { startQueueTaskAction } from "@/app/actions/employee";
import { resumeTaskTimerAction } from "@/app/actions/production";
import { useEmployeeWorkflow } from "@/components/employee/employee-workflow-context";
import { WorkEligibilityGateDialog } from "@/components/employee/work-eligibility-gate-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { priorityLabel } from "@/lib/constants";
import { formatActionError } from "@/lib/errors/action-messages";
import { navigateToTaskWorkspace } from "@/lib/employee/task-navigation";
import {
  formatQueueDueFriendly,
  formatQueueTaskLocation,
  taskProgressPercent,
} from "@/lib/employee/queue";
import { cn } from "@/lib/utils";
import type { TaskTimeEntry } from "@/types/flow";
import { LogIn, Play, Target } from "lucide-react";

export function EmployeeTodaysMission({ activeTaskTimer }: { activeTaskTimer: TaskTimeEntry | null }) {
  const wf = useEmployeeWorkflow();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gateOpen, setGateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mission = wf.missionTask;
  const timerPaused = activeTaskTimer?.status === "paused";
  const timerActive = activeTaskTimer?.status === "active";
  const progress = mission ? taskProgressPercent(mission) : null;

  function handlePrimaryAction() {
    if (!mission) return;

    if (wf.missionMode === "clock_in_to_resume") {
      startTransition(async () => {
        try {
          await clockInAction();
          router.refresh();
        } catch (e) {
          setError(formatActionError(e));
        }
      });
      return;
    }

    if (!wf.workEligible) {
      setGateOpen(true);
      return;
    }

    if (wf.missionMode === "active" || wf.missionMode === "paused") {
      if (timerPaused) {
        startTransition(async () => {
          const res = await resumeTaskTimerAction();
          if (!res.ok && "message" in res && res.message) {
            setGateOpen(true);
            return;
          }
          navigateToTaskWorkspace(router, mission.id);
        });
      } else {
        navigateToTaskWorkspace(router, mission.id);
      }
      return;
    }

    if (wf.missionMode === "staged" || wf.missionMode === "next") {
      setError(null);
      startTransition(async () => {
        const res = await startQueueTaskAction(mission.id);
        if (!res.ok) {
          setError(res.message ?? "Could not start task");
          return;
        }
        navigateToTaskWorkspace(router, res.taskId, { autostart: true });
      });
    }
  }

  const panelOwnsPrimaryAction =
    wf.actions.clockIn ||
    wf.actions.continueTask ||
    (wf.missionMode === "staged" && wf.actions.startTask) ||
    (wf.actions.startTask && wf.missionMode === "next");

  const primaryLabel =
    wf.missionMode === "clock_in_to_resume"
      ? "Clock In to Continue"
      : wf.missionMode === "staged"
        ? "Start Task Timer"
        : wf.missionMode === "paused"
          ? "Resume Work"
          : wf.missionMode === "active"
            ? "Continue Work"
            : wf.missionMode === "next"
              ? "Start Work"
              : null;

  const sectionTitle =
    wf.missionMode === "active" || wf.missionMode === "paused"
      ? "Today's Mission"
      : wf.missionMode === "staged"
        ? "Resume Task"
        : wf.missionMode === "next"
          ? "Next Task"
          : "Today's Mission";

  return (
    <section className="enterprise-panel-elevated border-primary/30 p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary shrink-0" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary">{sectionTitle}</h2>
      </div>

      {!mission ? (
        <div className="py-6 text-center space-y-3">
          <p className="text-base font-medium text-muted-foreground">No active task assigned.</p>
          <p className="text-sm text-muted-foreground">
            {wf.actions.requestWork
              ? "Use Request Work above if you need additional assignments."
              : wf.state === "CLOCKED_OUT"
                ? "Clock in to begin when work is assigned."
                : "Your team lead will assign work when it is ready."}
          </p>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold leading-tight">{mission.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{formatQueueTaskLocation(mission)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Priority</dt>
              <dd className="font-semibold mt-0.5">{priorityLabel(mission.priority)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Due date</dt>
              <dd className="font-semibold mt-0.5">{formatQueueDueFriendly(mission)}</dd>
            </div>
          </dl>

          {progress != null &&
            (wf.missionMode === "active" || wf.missionMode === "paused" || wf.missionMode === "staged") && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium uppercase tracking-wide">
                  Progress
                </span>
                <span className="font-bold tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}

          {timerActive && wf.missionMode === "active" && (
            <p className="text-xs text-emerald-500 font-medium">Timer running on this task</p>
          )}
          {timerPaused && wf.missionMode === "paused" && (
            <p className="text-xs text-amber-500 font-medium">Timer paused — tap to resume</p>
          )}

          {primaryLabel && !panelOwnsPrimaryAction && (
            <Button
              size="lg"
              className={cn("w-full h-12 text-base font-bold uppercase tracking-wide")}
              disabled={pending}
              onClick={handlePrimaryAction}
            >
              {wf.missionMode === "clock_in_to_resume" ? (
                <LogIn className="h-5 w-5 mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {primaryLabel}
            </Button>
          )}

          {(wf.missionMode === "active" || wf.missionMode === "paused") &&
            wf.actions.continueTask &&
            !panelOwnsPrimaryAction && (
            <Link
              href={`/work/${mission.id}`}
              prefetch={false}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-center")}
            >
              Open full workspace
            </Link>
          )}
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <WorkEligibilityGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        message="You must be clocked in before starting work."
        onClockedIn={() => router.refresh()}
      />
    </section>
  );
}
