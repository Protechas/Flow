"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCommentAction } from "@/app/actions/crud";
import { employeeUpdateNotesAction } from "@/app/actions/employee";
import {
  pauseTaskTimerAction,
  resumeTaskTimerAction,
  startTaskTimerAction,
  stopTaskTimerAction,
  submitTaskForReviewAction,
} from "@/app/actions/production";
import { HelpFlagDialog } from "@/components/help-flags/help-flag-dialog";
import { HelpFlagStatusList } from "@/components/help-flags/help-flag-status";
import { TaskFileUploadZone } from "@/components/employee/task-file-upload-zone";
import { TaskLiveForecastPanel } from "@/components/forecast/task-live-forecast-panel";
import { ProductionMetricsPanel } from "@/components/production/production-metrics-panel";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContextBreadcrumb } from "@/components/layout/context-breadcrumb";
import { useFlowToast } from "@/components/ui/flow-toast";
import { formatActionError } from "@/lib/errors/action-messages";
import { computeProductionMetrics, formatMinutes } from "@/lib/production/metrics";
import { WORK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  Comment,
  HelpFlagView,
  TaskFileUpload,
  TaskSubmissionRecord,
  TaskTimeEntry,
  WorkPackage,
} from "@/types/flow";
import {
  AlertTriangle,
  MessageSquare,
  Pause,
  Play,
  Send,
  Square,
  StickyNote,
} from "lucide-react";

function useTimerDisplay(entry: TaskTimeEntry | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!entry || entry.status !== "active") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [entry]);

  if (!entry) return "00:00:00";

  let minutes = entry.total_active_minutes;
  if (entry.status === "active") {
    const from = new Date(entry.resumed_at ?? entry.started_at).getTime();
    minutes += Math.max(0, Math.floor((Date.now() - from) / 60000));
  }
  const totalSec = minutes * 60 + (tick % 60 && entry.status === "active" ? tick % 60 : 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function EmployeeTaskWorkspace({
  task,
  comments,
  files,
  userId,
  autostart,
  activeTimer,
  anyActiveTimer,
  totalMinutes,
  latestSubmission,
  helpFlags = [],
}: {
  task: WorkPackage;
  comments: Comment[];
  files: TaskFileUpload[];
  userId: string;
  autostart?: boolean;
  activeTimer: TaskTimeEntry | null;
  anyActiveTimer: TaskTimeEntry | null;
  totalMinutes: number;
  latestSubmission: TaskSubmissionRecord | null;
  helpFlags?: HelpFlagView[];
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [showNotes, setShowNotes] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const timerOnThisTask = activeTimer?.task_id === task.id ? activeTimer : null;
  const display = useTimerDisplay(timerOnThisTask);
  const running = timerOnThisTask?.status === "active";
  const paused = timerOnThisTask?.status === "paused";

  const pkgComments = comments.filter((c) => c.work_package_id === task.id);
  const statusLabel = WORK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status;

  const canWork = !["done", "ready_for_qa", "in_qa"].includes(task.status);
  const canSubmit = ["working_on_it", "correction_needed", "assigned"].includes(task.status);
  const metrics = computeProductionMetrics(totalMinutes, files.length);

  const otherActive =
    anyActiveTimer && anyActiveTimer.task_id !== task.id ? anyActiveTimer : null;

  useEffect(() => {
    if (autostart && canWork && !anyActiveTimer) {
      startTransition(async () => {
        const res = await startTaskTimerAction(task.id);
        if (!res.ok) setWarn("Finish your current active task before starting another.");
        router.refresh();
      });
    }
  }, [autostart, task.id, canWork, anyActiveTimer, router]);

  function handleStart() {
    setWarn(null);
    startTransition(async () => {
      const res = await startTaskTimerAction(task.id);
      if (!res.ok) {
        setWarn("You already have an active task. Stop or pause it before starting this one.");
        return;
      }
      router.refresh();
    });
  }

  function handlePause() {
    startTransition(async () => {
      await pauseTaskTimerAction();
      router.refresh();
    });
  }

  function handleResume() {
    startTransition(async () => {
      await resumeTaskTimerAction();
      router.refresh();
    });
  }

  function handleStop() {
    startTransition(async () => {
      await stopTaskTimerAction();
      router.refresh();
    });
  }

  function handleSubmit() {
    if (files.length < 1) {
      const msg = "Upload at least one completed file before submitting for review.";
      setWarn(msg);
      toast({ variant: "warning", title: "Files required", description: msg });
      return;
    }
    setWarn(null);
    startTransition(async () => {
      if (timerOnThisTask) await stopTaskTimerAction();
      const res = await submitTaskForReviewAction(task.id);
      if (!res.ok) {
        const description = formatActionError(new Error(res.message));
        setWarn(description);
        toast({ variant: "error", title: "Could not submit", description });
        return;
      }
      toast({ variant: "success", title: "Submitted for QA", description: "Your task is in the review queue." });
      router.push("/work");
      router.refresh();
    });
  }

  function saveNotes() {
    if (notes === (task.notes ?? "")) return;
    startTransition(async () => {
      await employeeUpdateNotesAction(task.id, notes);
    });
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col pb-24 sm:pb-8">
      <ContextBreadcrumb
        segments={[
          { label: "Work", href: "/work" },
          { label: task.project?.name ?? "Project" },
          { label: task.title },
        ]}
        className="mb-3"
      />
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/work"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-xs")}
        >
          ← Back
        </Link>
        <StatusBadge status={task.status} />
      </div>

      {otherActive && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            You have another task running.{" "}
            <Link href={`/work/${otherActive.task_id}`} className="underline font-medium">
              Go to active task
            </Link>
          </span>
        </div>
      )}

      {warn && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {warn}
        </div>
      )}

      <div className="flex-1 space-y-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Current task</p>
          <h1 className="text-xl sm:text-2xl font-bold leading-tight mt-1">{task.title}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Project</dt>
              <dd className="font-medium">{task.project?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Manufacturer</dt>
              <dd className="font-medium">{task.manufacturer?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Year</dt>
              <dd className="font-medium">{task.year}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Due</dt>
              <dd className="font-medium">{task.due_date ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Expected completion</dt>
              <dd className="font-medium">{task.suggested_due_date ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <TaskLiveForecastPanel task={task} allowManualProgress />

        <div className="enterprise-panel p-5 sm:p-6 text-center">
          <p className="enterprise-label mb-2">Task timer · {statusLabel}</p>
          <p className="text-4xl sm:text-5xl font-mono font-semibold tabular-nums tracking-tight text-foreground">
            {display}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatMinutes(totalMinutes)} total on this task
          </p>
          {canWork && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {!timerOnThisTask && (
                <Button size="lg" className="min-w-[120px]" onClick={handleStart} disabled={pending || !!otherActive}>
                  <Play className="h-4 w-4 mr-2" />
                  Start task
                </Button>
              )}
              {running && (
                <Button size="lg" variant="secondary" className="min-w-[120px]" onClick={handlePause} disabled={pending}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {paused && (
                <Button size="lg" className="min-w-[120px]" onClick={handleResume} disabled={pending}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
              {timerOnThisTask && (
                <Button size="lg" variant="outline" className="min-w-[120px]" onClick={handleStop} disabled={pending}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              <HelpFlagDialog
                taskId={task.id}
                source={timerOnThisTask ? "timer" : "task"}
                onSubmitted={() => router.refresh()}
              />
            </div>
          )}
        </div>

        <HelpFlagStatusList flags={helpFlags} />

        <ProductionMetricsPanel metrics={metrics} fileCount={files.length} />

        {latestSubmission && (
          <div className="enterprise-panel px-4 py-3 text-sm">
            <p className="enterprise-label">Last submission</p>
            <p className="text-muted-foreground mt-1">
              {new Date(latestSubmission.submitted_at).toLocaleString()} ·{" "}
              {latestSubmission.uploaded_file_count} files ·{" "}
              {latestSubmission.documents_per_hour} docs/hr
            </p>
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Completed files ({files.length})
          </h2>
          <TaskFileUploadZone
            taskId={task.id}
            files={files}
            disabled={!canWork || pending}
            onUploaded={() => router.refresh()}
          />
        </section>

        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground"
            onClick={() => setShowNotes((s) => !s)}
          >
            <StickyNote className="h-3.5 w-3.5" />
            Notes {showNotes ? "▾" : "▸"}
          </button>
          {showNotes && (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={4}
              placeholder="Work notes, findings, blockers…"
              disabled={!canWork || pending}
            />
          )}
        </div>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments ({pkgComments.length})
          </h2>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {pkgComments.map((c) => (
              <li key={c.id} className="text-sm rounded-lg bg-muted/30 px-3 py-2">
                {c.body}
              </li>
            ))}
          </ul>
          {canWork && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const body = (fd.get("body") as string).trim();
                if (!body) return;
                startTransition(async () => {
                  await createCommentAction(task.id, userId, body);
                  (e.target as HTMLFormElement).reset();
                  router.refresh();
                });
              }}
            >
              <Textarea name="body" rows={2} placeholder="Add a comment…" disabled={pending} className="text-sm" />
              <Button type="submit" size="sm" className="mt-2 h-9" disabled={pending}>
                Add comment
              </Button>
            </form>
          )}
        </section>
      </div>

      {canWork && canSubmit && (
        <div className="fixed bottom-0 left-0 right-0 sm:relative sm:mt-6 p-4 sm:p-0 bg-background/95 sm:bg-transparent border-t sm:border-0 border-border/60 backdrop-blur-md">
          <div className="max-w-3xl mx-auto">
            <Button className="w-full h-12" disabled={pending || files.length < 1} onClick={handleSubmit}>
              <Send className="h-4 w-4 mr-2" />
              Submit for review
              {files.length < 1 && (
                <span className="ml-2 text-xs opacity-80">(upload files first)</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
