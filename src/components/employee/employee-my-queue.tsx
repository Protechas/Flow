"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startQueueTaskAction } from "@/app/actions/employee";
import { resumeTaskTimerAction } from "@/app/actions/production";
import { WorkEligibilityGateDialog } from "@/components/employee/work-eligibility-gate-dialog";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { navigateToTaskWorkspace } from "@/lib/employee/task-navigation";
import {
  formatQueueDueLabel,
  formatQueueTaskLocation,
  type EmployeeMyQueue,
} from "@/lib/employee/queue";
import type { WorkEligibility } from "@/lib/work-eligibility";
import { cn } from "@/lib/utils";
import type { TaskTimeEntry, WorkPackage } from "@/types/flow";
import { CheckCircle2, ChevronDown, Clock, ListTodo, Play } from "lucide-react";

export function EmployeeMyQueue({
  queue,
  activeTaskTimer,
  workEligibility,
  readOnly = false,
}: {
  queue: EmployeeMyQueue;
  activeTaskTimer: TaskTimeEntry | null;
  workEligibility: WorkEligibility;
  /** Manager view — no start/resume actions */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blockedOpen, setBlockedOpen] = useState(queue.blocked.length > 0 && queue.blocked.length <= 3);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateMessage, setGateMessage] = useState("You must be clocked in before starting work.");
  const [error, setError] = useState<string | null>(null);

  const timerPaused = activeTaskTimer?.status === "paused";
  const timerActive = activeTaskTimer?.status === "active";
  const canPerformWork = workEligibility.eligible;

  function openGate(message?: string) {
    setGateMessage(message ?? "You must be clocked in before starting work.");
    setGateOpen(true);
  }

  function handleStartTask(taskId: string) {
    if (!canPerformWork) {
      openGate();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await startQueueTaskAction(taskId);
      if (!res.ok) {
        setError(res.message ?? "Could not start task");
        return;
      }
      navigateToTaskWorkspace(router, res.taskId, { autostart: true });
    });
  }

  function handleResume() {
    if (!canPerformWork) {
      openGate("You must be clocked in before resuming work.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await resumeTaskTimerAction();
      if (!res.ok && "message" in res && res.message) {
        openGate(res.message);
        return;
      }
      if (queue.current) {
        navigateToTaskWorkspace(router, queue.current.id);
      } else {
        router.refresh();
      }
    });
  }

  if (!queue.hasAnyTasks) {
    return (
      <section className="enterprise-panel p-6 text-center space-y-2">
        <ListTodo className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <h2 className="text-base font-semibold">My Queue</h2>
        <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="flow-section-title">My Queue</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {queue.upNext.length + (queue.current ? 1 : 0)} active
        </span>
      </div>

      <CurrentTaskCard
        task={queue.current}
        readOnly={readOnly}
        pending={pending}
        timerPaused={timerPaused}
        timerActive={timerActive}
        onStart={() => queue.current && handleStartTask(queue.current.id)}
        onResume={handleResume}
      />

      {queue.upNext.length > 0 && (
        <QueueSection title="Up Next" count={queue.upNext.length}>
          <ul className="divide-y divide-border/60">
            {queue.upNext.map((task) => (
              <QueueRow
                key={task.id}
                task={task}
                readOnly={readOnly}
                pending={pending}
                actionLabel="Start"
                onAction={() => handleStartTask(task.id)}
              />
            ))}
          </ul>
        </QueueSection>
      )}

      {queue.blocked.length > 0 && (
        <QueueSection
          title="Waiting / Blocked"
          count={queue.blocked.length}
          collapsible
          open={blockedOpen}
          onToggle={() => setBlockedOpen((v) => !v)}
          muted
        >
          <ul className="divide-y divide-border/60">
            {queue.blocked.map(({ task, label }) => (
              <li key={task.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="flow-meta truncate">{formatQueueTaskLocation(task)}</p>
                    <p className="text-xs text-amber-500/90 mt-1">{label}</p>
                  </div>
                  {!readOnly && (
                    <Link
                      href={`/work/${task.id}`}
              prefetch={false}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 h-8")}
                    >
                      View
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </QueueSection>
      )}

      {queue.completedToday.length > 0 && (
        <QueueSection title="Completed Today" count={queue.completedToday.length} compact>
          <ul className="divide-y divide-border/60">
            {queue.completedToday.map((task) => (
              <li key={task.id} className="px-4 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {formatQueueTaskLocation(task)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </QueueSection>
      )}

      {error && <p className="text-sm text-destructive px-1">{error}</p>}

      {!readOnly && (
        <WorkEligibilityGateDialog
          open={gateOpen}
          onOpenChange={setGateOpen}
          message={gateMessage}
        />
      )}
    </section>
  );
}

function CurrentTaskCard({
  task,
  readOnly,
  pending,
  timerPaused,
  timerActive,
  onStart,
  onResume,
}: {
  task: WorkPackage | null;
  readOnly: boolean;
  pending: boolean;
  timerPaused: boolean;
  timerActive: boolean;
  onStart: () => void;
  onResume: () => void;
}) {
  if (!task) {
    return (
      <div className="enterprise-panel border-dashed p-5 text-center">
        <p className="text-sm text-muted-foreground">No active task right now.</p>
        <p className="text-xs text-muted-foreground mt-1">Pick one from Up Next when you&apos;re ready.</p>
      </div>
    );
  }

  const due = formatQueueDueLabel(task);

  return (
    <div className="enterprise-panel-elevated border-primary/25 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="enterprise-label mb-0">Current Task</p>
        <StatusBadge status={task.status} size="sm" />
      </div>

      <div>
        <h3 className="text-base sm:text-lg font-semibold leading-snug">{task.title}</h3>
        <p className="flow-meta mt-1">{formatQueueTaskLocation(task)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {due && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Due {due}
          </span>
        )}
        {timerActive && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
            Timer running
          </span>
        )}
        {timerPaused && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            Timer paused
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-2">
          {timerPaused ? (
            <Button size="lg" className="h-11 flex-1" disabled={pending} onClick={onResume}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          ) : timerActive ? (
            <Link
              href={`/work/${task.id}`}
              prefetch={false}
              className={cn(buttonVariants({ size: "lg" }), "h-11 flex-1")}
            >
              <Play className="h-4 w-4 mr-2" />
              Open task
            </Link>
          ) : (
            <Button size="lg" className="h-11 flex-1" disabled={pending} onClick={onStart}>
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}
          <Link
            href={`/work/${task.id}`}
              prefetch={false}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 flex-1")}
          >
            Open workspace
          </Link>
        </div>
      )}
    </div>
  );
}

function QueueRow({
  task,
  readOnly,
  pending,
  actionLabel,
  onAction,
}: {
  task: WorkPackage;
  readOnly: boolean;
  pending: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  const due = formatQueueDueLabel(task);

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="flow-meta truncate">{formatQueueTaskLocation(task)}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <PriorityBadge priority={task.priority} />
            {due && (
              <span className="text-[10px] text-muted-foreground">Due {due}</span>
            )}
          </div>
        </div>
        {!readOnly ? (
          <Button
            size="sm"
            className="shrink-0 h-9 min-w-[4.5rem]"
            disabled={pending}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : (
          <StatusBadge status={task.status} size="sm" />
        )}
      </div>
    </li>
  );
}

function QueueSection({
  title,
  count,
  children,
  collapsible,
  open,
  onToggle,
  muted,
  compact,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  muted?: boolean;
  compact?: boolean;
}) {
  const header = (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] tabular-nums text-muted-foreground">({count})</span>
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-expanded={open}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );

  if (collapsible && !open) {
    return (
      <div className={cn("enterprise-panel overflow-hidden", muted && "opacity-90")}>
        {header}
      </div>
    );
  }

  return (
    <div className={cn("enterprise-panel overflow-hidden", muted && "border-amber-500/20")}>
      {header}
      <div className={compact ? "text-sm" : undefined}>{children}</div>
    </div>
  );
}
