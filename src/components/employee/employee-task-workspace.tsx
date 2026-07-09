"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCommentAction } from "@/app/actions/crud";
import { employeeUpdateNotesAction, switchToTaskAction } from "@/app/actions/employee";
import {
  pauseTaskTimerAction,
  resumeTaskTimerAction,
  startTaskTimerAction,
  stopTaskTimerAction,
  submitBatchForReviewAction,
  submitTaskForReviewAction,
} from "@/app/actions/production";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpFlagDialog } from "@/components/help-flags/help-flag-dialog";
import { WorkEligibilityGateDialog } from "@/components/employee/work-eligibility-gate-dialog";
import { HelpFlagStatusList } from "@/components/help-flags/help-flag-status";
import { TaskFileUploadZone } from "@/components/employee/task-file-upload-zone";
import { TaskSubmitChecklistPanel } from "@/components/employee/task-submit-checklist";
import { TaskLiveForecastPanel } from "@/components/forecast/task-live-forecast-panel";
import { primaryDueDate } from "@/lib/forecast/live";
import { ProductionMetricsPanel } from "@/components/production/production-metrics-panel";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContextBreadcrumb } from "@/components/layout/context-breadcrumb";
import { useFlowToast } from "@/components/ui/flow-toast";
import {
  EmployeeWorkflowProvider,
  useEmployeeWorkflow,
} from "@/components/employee/employee-workflow-context";
import { formatActionError } from "@/lib/errors/action-messages";
import type { WorkEligibility } from "@/lib/work-eligibility";
import type { EmployeeWorkflowInput } from "@/lib/employee/workflow-state";
import { computeProductionMetrics, formatMinutes } from "@/lib/production/metrics";
import { WORK_STATUSES } from "@/lib/constants";
import { getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
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
  Layers,
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
  workflowInput,
  ...props
}: {
  task: WorkPackage;
  comments: Comment[];
  files: TaskFileUpload[];
  totalFileCount?: number;
  userId: string;
  autostart?: boolean;
  activeTimer: TaskTimeEntry | null;
  anyActiveTimer: TaskTimeEntry | null;
  totalMinutes: number;
  allTimeMinutes?: number;
  latestSubmission: TaskSubmissionRecord | null;
  helpFlags?: HelpFlagView[];
  workEligibility: WorkEligibility;
  workflowInput: EmployeeWorkflowInput;
}) {
  return (
    <EmployeeWorkflowProvider input={workflowInput}>
      <EmployeeTaskWorkspaceContent {...props} />
    </EmployeeWorkflowProvider>
  );
}

function EmployeeTaskWorkspaceContent({
  task,
  comments,
  files,
  totalFileCount,
  userId,
  autostart,
  activeTimer,
  anyActiveTimer,
  totalMinutes,
  allTimeMinutes,
  latestSubmission,
  helpFlags = [],
  workEligibility,
}: {
  task: WorkPackage;
  comments: Comment[];
  files: TaskFileUpload[];
  totalFileCount?: number;
  userId: string;
  autostart?: boolean;
  activeTimer: TaskTimeEntry | null;
  anyActiveTimer: TaskTimeEntry | null;
  totalMinutes: number;
  allTimeMinutes?: number;
  latestSubmission: TaskSubmissionRecord | null;
  helpFlags?: HelpFlagView[];
  workEligibility: WorkEligibility;
}) {
  const wf = useEmployeeWorkflow();
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [showNotes, setShowNotes] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [autostartFailed, setAutostartFailed] = useState(false);
  const [eligibilityGateOpen, setEligibilityGateOpen] = useState(false);
  const [confirmFinalOpen, setConfirmFinalOpen] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState(
    "You must be clocked in before starting work."
  );
  const autostartAttempted = useRef(false);

  const canPerformWork = wf.workEligible;
  const timerOnThisTask = activeTimer?.task_id === task.id ? activeTimer : null;
  const display = useTimerDisplay(timerOnThisTask);
  const running = timerOnThisTask?.status === "active";
  const paused = timerOnThisTask?.status === "paused";
  const isThisActiveTask = wf.activeTaskId === task.id;
  const isThisStagedTask = wf.stagedTaskId === task.id;

  const pkgComments = comments.filter((c) => c.work_package_id === task.id);
  const statusLabel = WORK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status;
  const hierarchyLabels = task.project
    ? getProjectHierarchyLabels(task.project)
    : getProjectHierarchyLabels({});

  const canWork = !["done", "ready_for_qa", "in_qa"].includes(task.status);
  const canSubmit = ["working_on_it", "correction_needed", "assigned"].includes(task.status);
  const metrics = computeProductionMetrics(totalMinutes, files.length);

  // `files` is already pending-session scoped (uploads since the last
  // submission) — exactly what a batch sends to QA. The whole-task count
  // gates the final handoff so batching everything doesn't block completion.
  const batchFiles = latestSubmission
    ? files.filter((f) => f.uploaded_at > latestSubmission.submitted_at)
    : files;
  const taskFileTotal = totalFileCount ?? files.length;
  const estimatedDocs = task.estimated_document_count ?? null;
  const looksUnfinished = estimatedDocs != null && taskFileTotal < estimatedDocs * 0.8;

  const otherActive =
    anyActiveTimer && anyActiveTimer.task_id !== task.id ? anyActiveTimer : null;

  const startButtonLabel =
    isThisStagedTask && !timerOnThisTask ? "Start Task Timer" : "Start task";

  function openEligibilityGate(message?: string) {
    if (workEligibility.status === "needs_setup") {
      setEligibilityMessage(
        message ??
          "Your account setup is not complete. Please contact your manager or administrator."
      );
    } else {
      setEligibilityMessage(message ?? "You must be clocked in before starting work.");
    }
    setEligibilityGateOpen(true);
  }

  function reportTimerFailure(message: string, opts?: { gate?: boolean }) {
    setWarn(message);
    setAutostartFailed(true);
    toast({ variant: "error", title: "Could not start task timer", description: message });
    if (opts?.gate) openEligibilityGate(message);
  }

  useEffect(() => {
    if (autostartAttempted.current) return;

    const shouldAttempt =
      Boolean(autostart) || (isThisStagedTask && canWork && canPerformWork && !timerOnThisTask);
    if (!shouldAttempt || !canWork || !canPerformWork || timerOnThisTask || otherActive) return;

    autostartAttempted.current = true;
    startTransition(async () => {
      const res = await startTaskTimerAction(task.id);
      if (!res.ok) {
        if ("message" in res && res.message) {
          reportTimerFailure(res.message, { gate: true });
        } else {
          reportTimerFailure("Finish your current active task before starting another.");
        }
        return;
      }
      setAutostartFailed(false);
      setWarn(null);
      router.refresh();
    });
  }, [
    autostart,
    task.id,
    canWork,
    canPerformWork,
    timerOnThisTask,
    otherActive,
    isThisStagedTask,
    router,
  ]);

  function handleStart() {
    if (!canPerformWork) {
      openEligibilityGate();
      return;
    }
    setWarn(null);
    setAutostartFailed(false);
    startTransition(async () => {
      const res = await startTaskTimerAction(task.id);
      if (!res.ok) {
        if ("message" in res && res.message) {
          reportTimerFailure(res.message, { gate: true });
        } else {
          reportTimerFailure("You already have an active task. Stop or pause it before starting this one.");
        }
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
    if (!canPerformWork) {
      openEligibilityGate("You must be clocked in before resuming work.");
      return;
    }
    setAutostartFailed(false);
    startTransition(async () => {
      const res = await resumeTaskTimerAction();
      if (!res.ok && "message" in res && res.message) {
        reportTimerFailure(res.message, { gate: true });
        return;
      }
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
    if (!canPerformWork) {
      openEligibilityGate("You must be clocked in before submitting work.");
      return;
    }
    if (taskFileTotal < 1) {
      const msg = "Upload at least one completed file before submitting for review.";
      setWarn(msg);
      toast({ variant: "warning", title: "Files required", description: msg });
      return;
    }
    setConfirmFinalOpen(true);
  }

  function confirmFinalSubmit() {
    setConfirmFinalOpen(false);
    setWarn(null);
    startTransition(async () => {
      if (timerOnThisTask) await stopTaskTimerAction();
      const res = await submitTaskForReviewAction(task.id);
      if (!res.ok) {
        const description =
          "message" in res && res.message
            ? res.message
            : formatActionError(new Error("Submission failed"));
        setWarn(description);
        toast({ variant: "error", title: "Could not submit", description });
        return;
      }
      toast({ variant: "success", title: "Submitted for QA", description: "Your task is in the review queue." });
      router.push("/work");
      router.refresh();
    });
  }

  function handleSubmitBatch() {
    if (!canPerformWork) {
      openEligibilityGate("You must be clocked in before submitting work.");
      return;
    }
    setWarn(null);
    startTransition(async () => {
      const res = await submitBatchForReviewAction(task.id);
      if (!res.ok) {
        const description =
          "message" in res && res.message
            ? res.message
            : formatActionError(new Error("Batch submission failed"));
        setWarn(description);
        toast({ variant: "error", title: "Could not submit batch", description });
        return;
      }
      toast({
        variant: "success",
        title: "Batch sent for review",
        description: `${res.fileCount} file${res.fileCount === 1 ? "" : "s"} sent to QA — keep working, this task stays yours.`,
      });
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

      <div
        className={cn(
          "mb-4 rounded-lg border px-4 py-3",
          wf.statusAccent === "success" && "border-emerald-500/30 bg-emerald-500/10",
          wf.statusAccent === "warning" && "border-amber-500/30 bg-amber-500/10",
          wf.statusAccent === "danger" && "border-red-500/30 bg-red-500/10",
          wf.statusAccent === "neutral" && "border-border/60 bg-muted/10"
        )}
      >
        <p className="text-sm font-semibold">{wf.statusTitle}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{wf.statusDescription}</p>
        {isThisActiveTask && running && (
          <p className="text-xs text-emerald-400 mt-2 font-medium">Timer running on this task</p>
        )}
        {isThisActiveTask && paused && (
          <p className="text-xs text-amber-400 mt-2 font-medium">Timer paused — resume to continue tracking</p>
        )}
        {isThisStagedTask && !timerOnThisTask && (
          <p className="text-xs text-amber-400 mt-2 font-medium">
            Timer not started — click {startButtonLabel} to begin tracking work.
          </p>
        )}
      </div>

      {otherActive && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-40 flex-1">
            You have another task running.{" "}
            <Link href={`/work/${otherActive.task_id}`} className="underline font-medium">
              Go to active task
            </Link>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-amber-500/40 text-xs"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await switchToTaskAction(task.id);
                if (!res.ok) {
                  toast({ variant: "error", title: "Could not switch", description: res.message });
                  return;
                }
                toast({
                  variant: "success",
                  title: "Switched tasks",
                  description: "Your previous session was saved — the task is back in Up Next.",
                });
                router.refresh();
              });
            }}
          >
            Switch to this task
          </Button>
        </div>
      )}

      {(warn || autostartFailed) && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {warn ?? "The task timer could not start automatically. Use the button below to start manually."}
        </div>
      )}

      {workEligibility.requiresClockIn && !canPerformWork && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          View-only mode — clock in to start timers, upload files, or submit work.
        </div>
      )}

      <WorkEligibilityGateDialog
        open={eligibilityGateOpen}
        onOpenChange={setEligibilityGateOpen}
        message={eligibilityMessage}
        onClockedIn={() => router.refresh()}
        allowClockIn={workEligibility.status !== "needs_setup"}
        title={
          workEligibility.status === "needs_setup"
            ? "Account setup required"
            : "Clock in required"
        }
      />

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
              <dt className="text-muted-foreground text-[10px] uppercase">{hierarchyLabels.workPackageShort}</dt>
              <dd className="font-medium">{task.manufacturer?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">{hierarchyLabels.phaseShort}</dt>
              <dd className="font-medium">{task.year}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Due</dt>
              <dd className="font-medium">{primaryDueDate(task) ?? task.due_date ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] uppercase">Expected completion</dt>
              <dd className="font-medium">{primaryDueDate(task) ?? "—"}</dd>
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
            {formatMinutes(totalMinutes)} since last submission
            {allTimeMinutes != null && allTimeMinutes !== totalMinutes
              ? ` · ${formatMinutes(allTimeMinutes)} total on this task`
              : ""}
          </p>
          {canWork && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {!timerOnThisTask && (
                <Button
                  size="lg"
                  className="min-w-[120px]"
                  onClick={handleStart}
                  disabled={pending || !!otherActive || !canPerformWork}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startButtonLabel}
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
            employeeViewer
            disabled={!canWork || pending || !canPerformWork || !wf.actions.uploadFiles}
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
          <div className="max-w-3xl mx-auto space-y-3">
            <TaskSubmitChecklistPanel taskId={task.id} refreshKey={files.length} />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                className="h-12 sm:flex-1"
                disabled={pending || batchFiles.length < 1 || !canPerformWork}
                onClick={handleSubmitBatch}
              >
                <Layers className="h-4 w-4 mr-2" />
                Submit batch for review
                <span className="ml-2 text-xs opacity-80">
                  {batchFiles.length > 0
                    ? `(${batchFiles.length} new file${batchFiles.length === 1 ? "" : "s"})`
                    : "(no new files)"}
                </span>
              </Button>
              <Button
                className="h-12 sm:flex-1"
                disabled={pending || taskFileTotal < 1 || !canPerformWork}
                onClick={handleSubmit}
              >
                <Send className="h-4 w-4 mr-2" />
                Complete task &amp; submit
                {taskFileTotal < 1 && (
                  <span className="ml-2 text-xs opacity-80">(upload files first)</span>
                )}
              </Button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Batches go to QA while you keep working. Completing the task locks it until review.
            </p>
          </div>
        </div>
      )}

      <Dialog open={confirmFinalOpen} onOpenChange={setConfirmFinalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {looksUnfinished ? "Submit the entire task?" : "Complete this task?"}
            </DialogTitle>
            <DialogDescription>
              This sends <span className="font-medium text-foreground">{task.title}</span> to QA
              and locks it until a reviewer finishes — you won&apos;t be able to work on it in the
              meantime.
            </DialogDescription>
          </DialogHeader>
          {looksUnfinished ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              You&apos;ve uploaded {taskFileTotal} of ~{estimatedDocs} estimated documents. If you
              just want your newest files reviewed, use{" "}
              <span className="font-medium">Submit batch for review</span> instead and keep
              working.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {taskFileTotal} file{taskFileTotal === 1 ? "" : "s"} will be included in the final
              review.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFinalOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={confirmFinalSubmit} disabled={pending}>
              {looksUnfinished ? "Yes, submit the whole task" : "Complete task & submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
