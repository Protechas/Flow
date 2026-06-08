"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCommentAction,
  createFileAction,
} from "@/app/actions/crud";
import {
  employeeLogTimerAction,
  employeeMarkCompleteAction,
  employeeStartTaskAction,
  employeeSubmitToQaAction,
  employeeUpdateNotesAction,
} from "@/app/actions/employee";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useTaskTimer } from "@/hooks/use-task-timer";
import { WORK_STATUSES } from "@/lib/constants";
import type { Comment, FlowFile, TimeLog, WorkPackage } from "@/types/flow";
import {
  CheckCircle2,
  MessageSquare,
  Pause,
  Play,
  Send,
  StickyNote,
  Upload,
} from "lucide-react";

export function EmployeeTaskWorkspace({
  task,
  comments,
  files,
  timeLogs,
  userId,
  autostart,
}: {
  task: WorkPackage;
  comments: Comment[];
  files: FlowFile[];
  timeLogs: TimeLog[];
  userId: string;
  autostart?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [showNotes, setShowNotes] = useState(false);
  const timer = useTaskTimer(task.id, autostart);

  const pkgComments = comments.filter((c) => c.work_package_id === task.id);
  const pkgFiles = files.filter((f) => f.work_package_id === task.id);
  const pkgLogs = timeLogs.filter((t) => t.work_package_id === task.id);
  const statusLabel = WORK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status;

  const canWork = !["done", "ready_for_qa", "in_qa"].includes(task.status);
  const canSubmitQa = ["working_on_it", "correction_needed", "assigned"].includes(task.status);
  const canComplete = task.status === "working_on_it" || task.status === "correction_needed";

  useEffect(() => {
    if (autostart && canWork) {
      startTransition(async () => {
        await employeeStartTaskAction(task.id);
      });
    }
  }, [autostart, task.id, canWork]);

  function saveNotes() {
    if (notes === (task.notes ?? "")) return;
    startTransition(async () => {
      await employeeUpdateNotesAction(task.id, notes);
    });
  }

  function handlePause() {
    const hours = timer.handlePause();
    if (hours && hours >= 0.01) {
      startTransition(async () => {
        await employeeLogTimerAction(task.id, hours);
      });
    }
  }

  function handleStart() {
    startTransition(async () => {
      await employeeStartTaskAction(task.id);
      timer.handleStart();
    });
  }

  function handleSubmitQa() {
    const hours = timer.hasTimer ? timer.handleStop() : 0;
    startTransition(async () => {
      if (hours >= 0.01) await employeeLogTimerAction(task.id, hours);
      await employeeSubmitToQaAction(task.id);
      router.push("/work");
      router.refresh();
    });
  }

  function handleComplete() {
    const hours = timer.hasTimer ? timer.handleStop() : 0;
    startTransition(async () => {
      if (hours >= 0.01) await employeeLogTimerAction(task.id, hours);
      await employeeMarkCompleteAction(task.id);
      router.push("/work");
      router.refresh();
    });
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col pb-24 sm:pb-8">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-xs" render={<Link href="/work" />}>
          ← Back
        </Button>
        <StatusBadge status={task.status} />
      </div>

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
          </dl>
        </div>

        <div className="enterprise-panel p-5 sm:p-6 text-center">
          <p className="enterprise-label mb-2">
            Timer · {statusLabel}
          </p>
          <p className="text-4xl sm:text-5xl font-mono font-semibold tabular-nums tracking-tight text-foreground">
            {timer.display}
          </p>
          {canWork && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {!timer.hasTimer && (
                <Button size="lg" className="min-w-[120px]" onClick={handleStart} disabled={pending}>
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
              {timer.running && (
                <Button size="lg" variant="secondary" className="min-w-[120px]" onClick={handlePause} disabled={pending}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {timer.paused && (
                <Button size="lg" className="min-w-[120px]" onClick={() => timer.handleResume()} disabled={pending}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
            </div>
          )}
          {pkgLogs.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-3">
              {pkgLogs.reduce((s, t) => s + Number(t.hours), 0)}h logged on this task
            </p>
          )}
        </div>

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

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <Upload className="h-3.5 w-3.5" />
            Files ({pkgFiles.length})
          </h2>
          <ul className="text-sm space-y-1">
            {pkgFiles.map((f) => (
              <li key={f.id} className="text-muted-foreground px-1">{f.file_name}</li>
            ))}
          </ul>
          {canWork && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = (fd.get("file_name") as string).trim();
                if (!name) return;
                startTransition(async () => {
                  await createFileAction({
                    work_package_id: task.id,
                    uploaded_by: userId,
                    file_name: name,
                  });
                  (e.target as HTMLFormElement).reset();
                  router.refresh();
                });
              }}
            >
              <Input name="file_name" placeholder="filename.xlsx" required disabled={pending} className="h-9 text-sm" />
              <Button type="submit" disabled={pending} size="sm" className="h-9">
                Upload
              </Button>
            </form>
          )}
        </section>
      </div>

      {canWork && (
        <div className="fixed bottom-0 left-0 right-0 sm:relative sm:mt-6 p-4 sm:p-0 bg-background/95 sm:bg-transparent border-t sm:border-0 border-border/60 backdrop-blur-md">
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            {canSubmitQa && (
              <Button className="h-12" disabled={pending} onClick={handleSubmitQa}>
                <Send className="h-4 w-4 mr-2" />
                Submit to QA
              </Button>
            )}
            {canComplete && (
              <Button className="h-12" variant="outline" disabled={pending} onClick={handleComplete}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark complete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
