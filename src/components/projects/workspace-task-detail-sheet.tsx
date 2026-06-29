"use client";

import { useEffect, useState, useTransition } from "react";
import { updateWorkPackageAction } from "@/app/actions/crud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  mergeTaskCustomFields,
  parseCustomFields,
  taskProgress,
} from "@/lib/projects/workspace-config";
import type { WorkspaceColumnDef } from "@/lib/projects/workspace-types";
import { primaryDueDate } from "@/lib/forecast/live";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import type { ForecastComplexityLevel, User, WorkPackage } from "@/types/flow";
import { Progress } from "@/components/ui/progress";

export function WorkspaceTaskDetailSheet({
  task,
  analysts,
  managers,
  canEdit,
  columns,
  showForecastFields = true,
  onClose,
  onUpdated,
}: {
  task: WorkPackage | null;
  analysts: User[];
  managers: User[];
  canEdit: boolean;
  columns: WorkspaceColumnDef[];
  /** When true, show estimated documents/files for due-date forecasting. */
  showForecastFields?: boolean;
  onClose: () => void;
  onUpdated: () => void;
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
    setCustomFields(parseCustomFields(task.description));
  }, [task]);

  function save() {
    if (!task) return;
    startTransition(async () => {
      const docCount = estimatedFiles.trim() === "" ? null : Number(estimatedFiles);
      await updateWorkPackageAction(task.id, {
        title: title.trim(),
        notes: notes.trim() || null,
        status,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        estimated_hours: Number(hours) || 0,
        estimated_document_count: docCount,
        complexity_level: complexity,
        description: mergeTaskCustomFields(task.description, customFields),
      });
      onUpdated();
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
              </div>

              <div className="space-y-2">
                <Label>Owner</Label>
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

              <div className={showForecastFields ? "grid grid-cols-2 gap-3" : "space-y-2"}>
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
                  <div className="space-y-2">
                    <Label>Estimated files</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 120"
                      value={estimatedFiles}
                      disabled={!canEdit}
                      onChange={(e) => setEstimatedFiles(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Used with forecasting to calculate suggested due dates.
                    </p>
                  </div>
                )}
              </div>

                {showForecastFields && (
                  <div className="space-y-2">
                    <Label>Complexity</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={complexity}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setComplexity(e.target.value as ForecastComplexityLevel)
                      }
                    >
                      {COMPLEXITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label} ({o.multiplier})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {showForecastFields && primaryDueDate(task) && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Forecasted due date: </span>
                  <span className="font-medium">{primaryDueDate(task)}</span>
                  {task.due_date_status && (
                    <span className="ml-2 text-xs capitalize text-muted-foreground">
                      ({task.due_date_status.replace(/_/g, " ")})
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Progress</Label>
                <Progress value={taskProgress(task)} />
              </div>

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
                {task.estimated_document_count != null && (
                  <p>Estimated files: {task.estimated_document_count}</p>
                )}
                <p>Corrections: {task.correction_count}</p>
              </div>

              {canEdit && (
                <Button className="w-full" disabled={pending} onClick={save}>
                  Save task
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
