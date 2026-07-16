"use client";

import { useEffect, useState, useTransition } from "react";
import { updateWorkPackageAction, deleteWorkPackageAction } from "@/app/actions/crud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import {
  TaskForecastMetricsEditor,
  formatTaskMinutesPerFile,
} from "@/components/forecast/task-forecast-metrics-editor";
import {
  mergeTaskCustomFields,
  parseCustomFields,
  taskProgress,
} from "@/lib/projects/workspace-config";
import type { TaskLiveTimer, WorkspaceColumnDef } from "@/lib/projects/workspace-types";
import type { ForecastComplexityLevel, ForecastSettings, User, WorkPackage } from "@/types/flow";
import { Progress } from "@/components/ui/progress";

export function WorkspaceTaskDetailSheet({
  task,
  analysts,
  managers,
  canEdit,
  canDelete = false,
  columns,
  forecastSettings,
  showForecastFields = true,
  liveTimers,
  onClose,
  onUpdated,
  onDeleted,
}: {
  task: WorkPackage | null;
  analysts: User[];
  managers: User[];
  canEdit: boolean;
  canDelete?: boolean;
  columns: WorkspaceColumnDef[];
  forecastSettings: ForecastSettings;
  /** When true, show estimated documents/files for due-date forecasting. */
  showForecastFields?: boolean;
  /** Live/paused timer sessions on this task, captured server-side. */
  liveTimers?: TaskLiveTimer[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(task?.status ?? "not_started");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [hours, setHours] = useState(String(task?.estimated_hours ?? 0));
  const [estimatedFiles, setEstimatedFiles] = useState(
    task?.estimated_document_count != null ? String(task.estimated_document_count) : ""
  );
  const [complexity, setComplexity] = useState<ForecastComplexityLevel>(
    task?.complexity_level ?? "standard"
  );
  const [minutesPerFile, setMinutesPerFile] = useState(
    formatTaskMinutesPerFile(task?.estimated_minutes_per_document)
  );
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  const people = [...managers, ...analysts];
  const customColumns = columns.filter((c) => !c.builtIn && c.visible);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStatus(task.status);
    setAssignedTo(task.assigned_to ?? "");
    setDueDate(task.due_date ?? "");
    setHours(String(task.estimated_hours ?? 0));
    setEstimatedFiles(
      task.estimated_document_count != null ? String(task.estimated_document_count) : ""
    );
    setComplexity(task.complexity_level ?? "standard");
    setMinutesPerFile(formatTaskMinutesPerFile(task.estimated_minutes_per_document));
    setCustomFields(parseCustomFields(task.description));
  }, [task]);

  function save() {
    if (!task) return;
    startTransition(async () => {
      const docCount = estimatedFiles.trim() === "" ? null : Number(estimatedFiles);
      const minutes =
        minutesPerFile.trim() === "" ? null : Number.isNaN(Number(minutesPerFile))
          ? null
          : Number(minutesPerFile);
      await updateWorkPackageAction(task.id, {
        title: title.trim(),
        notes: notes.trim() || null,
        status,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        estimated_hours: Number(hours) || 0,
        estimated_document_count: docCount,
        complexity_level: complexity,
        estimated_minutes_per_document: minutes,
        description: mergeTaskCustomFields(task.description, customFields),
      });
      onUpdated();
      onClose();
    });
  }

  function removeTask() {
    if (!task) return;
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteWorkPackageAction(task.id);
      onDeleted?.();
      onClose();
    });
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {task && (
          <>
            <SheetHeader>
              <SheetTitle>Task detail</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-1 pb-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {status.replace(/_/g, " ")}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {task.priority}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Task</Label>
                <Input value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
                {task.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Created {task.created_at.slice(0, 10)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Assign</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={assignedTo}
                  disabled={!canEdit}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm capitalize"
                    value={status}
                    disabled={!canEdit}
                    onChange={(e) => setStatus(e.target.value as WorkPackage["status"])}
                  >
                    {[
                      "not_started",
                      "assigned",
                      "working_on_it",
                      "waiting",
                      "ready_for_qa",
                      "in_qa",
                      "correction_needed",
                      "stuck",
                      "done",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={dueDate ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estimated hours</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hours}
                  disabled={!canEdit}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>

              {showForecastFields && (
                <TaskForecastMetricsEditor
                  forecastSettings={forecastSettings}
                  canEdit={canEdit}
                  estimatedFiles={estimatedFiles}
                  onEstimatedFilesChange={setEstimatedFiles}
                  complexity={complexity}
                  onComplexityChange={setComplexity}
                  minutesPerFile={minutesPerFile}
                  onMinutesPerFileChange={setMinutesPerFile}
                  manualDueDate={dueDate || undefined}
                  startDate={task.start_date ?? task.forecast_start_date}
                />
              )}

              {task.forecast_mode === "active" &&
                task.active_due_date &&
                (task.forecast_variance_days ?? 0) < 0 && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
                    <span className="font-medium text-red-500">
                      Tracking {Math.abs(task.forecast_variance_days ?? 0)} work day
                      {Math.abs(task.forecast_variance_days ?? 0) === 1 ? "" : "s"} behind standard
                    </span>{" "}
                    <span className="text-muted-foreground">
                      — at the current pace this lands {task.active_due_date}. The due date stays at
                      standard; the pace is the thing to fix.
                    </span>
                  </div>
                )}

              <div className="space-y-2">
                <Label>Progress</Label>
                <Progress value={taskProgress(task)} />
              </div>

              <TimeOnTask task={task} liveTimers={liveTimers} />

              {customColumns.map((col) => (
                <div key={col.id} className="space-y-2">
                  <Label>{col.label}</Label>
                  <Input
                    value={customFields[col.id] ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [col.id]: e.target.value }))
                    }
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  disabled={!canEdit}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p>QA: {task.qa_status}</p>
                <p>Uploaded files: {task.file_count}</p>
                <p>Corrections: {task.correction_count}</p>
              </div>

              {canEdit && (
                <Button className="w-full" disabled={pending} onClick={save}>
                  Save task
                </Button>
              )}

              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={removeTask}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete task
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function TimeOnTask({ task, liveTimers }: { task: WorkPackage; liveTimers?: TaskLiveTimer[] }) {
  // Re-render every 30s so a running timer visibly ticks
  const [, setTick] = useState(0);
  const hasRunning = (liveTimers ?? []).some((t) => t.status === "active");
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [hasRunning]);

  const banked = task.actual_hours ?? 0;
  const sessions = liveTimers ?? [];

  return (
    <div className="space-y-2">
      <Label>Time on task</Label>
      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Banked: <span className="font-medium text-foreground tabular-nums">{banked.toFixed(1)}h</span>
          <span className="ml-1">(saved when timers pause or finish)</span>
        </p>
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No timer running on this task right now.</p>
        ) : (
          sessions.map((s, i) => {
            const drift =
              s.status === "active"
                ? Math.max(0, (Date.now() - new Date(s.captured_at).getTime()) / 60000)
                : 0;
            return (
              <p key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    s.status === "active"
                      ? "h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                      : "h-2 w-2 rounded-full bg-amber-500/70 shrink-0"
                  }
                />
                <span className="font-medium">{s.user_name}</span>
                <span className="text-muted-foreground">
                  {s.status === "active" ? "on it now —" : "paused at"}
                </span>
                <span className="font-semibold tabular-nums">{formatMinutes(s.minutes + drift)}</span>
                <span className="text-muted-foreground text-xs">this session</span>
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}
