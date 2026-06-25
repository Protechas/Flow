"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFlowToast } from "@/components/ui/flow-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { Textarea } from "@/components/ui/textarea";
import { getHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { userDisplayName } from "@/lib/users/display-name";
import type { User, WorkPackage } from "@/types/flow";

/** Assign an existing task — new tasks use CreateTaskComposer. */
export function AssignTaskDialog({
  open,
  onOpenChange,
  analysts,
  workPackages,
  initialTaskId,
  initialAssigneeId,
  projectType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysts: User[];
  workPackages: WorkPackage[];
  initialTaskId?: string;
  initialAssigneeId?: string;
  projectType?: string | null;
}) {
  const labels = getHierarchyLabels(projectType);
  const { toast } = useFlowToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [taskId, setTaskId] = useState(initialTaskId ?? "");
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId ?? "__none__");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const activeTasks = useMemo(
    () => workPackages.filter((p) => p.status !== "done"),
    [workPackages]
  );

  function reset() {
    setTaskId(initialTaskId ?? "");
    setAssigneeId(initialAssigneeId ?? "__none__");
    setDueDate("");
    setNote("");
  }

  function submit() {
    startTransition(async () => {
      try {
        const assignee = assigneeId !== "__none__" ? assigneeId : null;
        if (!assignee) throw new Error("Select an employee to assign.");
        if (!taskId) throw new Error(`Select a ${labels.task.toLowerCase()} to assign.`);

        const { updateWorkPackageAction } = await import("@/app/actions/crud");
        await updateWorkPackageAction(taskId, {
          assigned_to: assignee,
          status: "assigned",
          ...(dueDate ? { due_date: dueDate, manual_due_date: dueDate } : {}),
          ...(note.trim() ? { notes: note.trim() } : {}),
        });

        toast({
          variant: "success",
          title: `${labels.task} assigned`,
          description: "The assignment was saved successfully.",
        });
        router.refresh();
        onOpenChange(false);
        reset();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not assign task",
          description: e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {labels.task.toLowerCase()}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Reassign an existing {labels.task.toLowerCase()}. To create a new one, use Create task.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assign to *</Label>
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "__none__")}>
              <SelectTrigger>
                <EntitySelectValue
                  value={assigneeId}
                  items={analysts}
                  getLabel={userDisplayName}
                  placeholder="Select employee"
                  sentinels={[{ value: "__none__", label: "Select employee" }]}
                />
              </SelectTrigger>
              <SelectContent>
                {analysts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {userDisplayName(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{labels.task} *</Label>
            <Select value={taskId} onValueChange={(v) => setTaskId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${labels.task.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {activeTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Assignment note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional context for the assignee"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Assigning…" : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
