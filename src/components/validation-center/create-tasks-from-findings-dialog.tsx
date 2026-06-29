"use client";

import { useMemo, useState, useTransition } from "react";
import { createTasksFromValidationFindingsAction } from "@/app/actions/validation-center";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowToast } from "@/components/ui/flow-toast";
import { userDisplayName } from "@/lib/users/display-name";
import { VALIDATION_SEVERITY_LABELS } from "@/lib/validation-center/types";
import type { ValidationFinding } from "@/lib/validation-center/types";
import type { Project, User } from "@/types/flow";
import { ListTodo } from "lucide-react";

export function CreateTasksFromFindingsDialog({
  open,
  onOpenChange,
  findings,
  projects,
  analysts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findings: ValidationFinding[];
  projects: Project[];
  analysts: User[];
  onCreated: (updated: ValidationFinding[]) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState("__none__");
  const [pending, startTransition] = useTransition();
  const { toast } = useFlowToast();

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "archived"),
    [projects]
  );

  const preview = useMemo(() => {
    const bySeverity = findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});
    return bySeverity;
  }, [findings]);

  function submit() {
    if (!projectId) {
      toast({ variant: "error", title: "Select a project" });
      return;
    }
    if (findings.length === 0) {
      toast({ variant: "error", title: "No findings selected" });
      return;
    }

    startTransition(async () => {
      const result = await createTasksFromValidationFindingsAction({
        findingIds: findings.map((f) => f.id),
        projectId,
        assignedTo: assigneeId !== "__none__" ? assigneeId : null,
      });
      if (!result.ok) {
        toast({ variant: "error", title: "Could not create tasks", description: result.message });
        return;
      }
      toast({
        variant: "success",
        title: `${result.tasksCreated} task${result.tasksCreated === 1 ? "" : "s"} created`,
        description: "Correction work is now in Flow operations.",
      });
      onCreated(result.findings);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Create Flow tasks from findings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            {findings.length} finding{findings.length === 1 ? "" : "s"} will become correction
            tasks under the selected project. Each task inherits severity as priority and includes
            audit evidence in the description.
          </p>

          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            {Object.entries(preview).map(([severity, count]) => (
              <div key={severity} className="flex justify-between gap-4">
                <span className="text-muted-foreground capitalize">
                  {VALIDATION_SEVERITY_LABELS[severity as keyof typeof VALIDATION_SEVERITY_LABELS] ??
                    severity}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Project *</Label>
            <Select value={projectId} onValueChange={(v) => v && setProjectId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {activeProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assignee (optional)</Label>
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "__none__")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {analysts.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {userDisplayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !projectId || findings.length === 0}>
            {pending ? "Creating…" : `Create ${findings.length} task${findings.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
