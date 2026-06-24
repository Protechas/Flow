"use client";

import { useState, useTransition } from "react";
import { updateProjectAction } from "@/app/actions/crud";
import { ProjectForecastSection } from "@/components/forecast/project-forecast-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogFooter,
  WizardDialogHeader,
  WizardDialogScroll,
} from "@/components/ui/wizard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STATUSES, PROJECT_TYPES, WORK_PRIORITIES } from "@/lib/constants";
import {
  projectOwnerCandidates,
  resolveOwnerLabel,
} from "@/lib/work-creation/client-defaults";
import { userDisplayName } from "@/lib/users/display-name";
import type {
  ForecastComplexityLevel,
  ForecastSettings,
  Project,
  User,
  WorkPriority,
} from "@/types/flow";
import { Pencil } from "lucide-react";

export function EditProjectDialog({
  project,
  managers,
  forecastSettings,
  viewer,
}: {
  project: Project;
  managers: User[];
  forecastSettings: ForecastSettings;
  viewer: User;
}) {
  const ownerCandidates = projectOwnerCandidates(managers, viewer);
  const ownerId = project.project_owner_id ?? "__none__";
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [docCount, setDocCount] = useState(
    project.estimated_total_documents != null ? String(project.estimated_total_documents) : ""
  );
  const [complexity, setComplexity] = useState<ForecastComplexityLevel>(
    project.planning_complexity_level ?? "standard"
  );
  const [manualDue, setManualDue] = useState(
    project.manual_project_due_date ?? project.due_date ?? ""
  );
  const [startDate, setStartDate] = useState(project.start_date ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const owner = fd.get("project_owner_id") as string;
    const docs = Number(fd.get("estimated_total_documents")) || null;
    startTransition(async () => {
      await updateProjectAction(project.id, {
        name: fd.get("name") as string,
        description: (fd.get("description") as string) || null,
        project_type: fd.get("project_type") as string,
        status: fd.get("status") as string,
        priority: fd.get("priority") as WorkPriority,
        start_date: (fd.get("start_date") as string) || null,
        due_date: (fd.get("due_date") as string) || null,
        manual_project_due_date: (fd.get("manual_project_due_date") as string) || null,
        estimated_total_documents: docs,
        planning_complexity_level:
          (fd.get("planning_complexity_level") as ForecastComplexityLevel) || "standard",
        project_owner_id: owner && owner !== "__none__" ? owner : null,
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <WizardDialogContent size="md">
        <WizardDialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll>
            <form id="edit-project-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" name="name" required defaultValue={project.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Input id="edit-desc" name="description" defaultValue={project.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select name="project_type" defaultValue={project.project_type}>
                <SelectTrigger>
                  <SelectValue>
                    {PROJECT_TYPES.find((t) => t.value === project.project_type)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue={project.status}>
                <SelectTrigger>
                  <SelectValue>
                    {PROJECT_STATUSES.find((s) => s.value === project.status)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue={project.priority}>
                <SelectTrigger>
                  <SelectValue>
                    {WORK_PRIORITIES.find((p) => p.value === project.priority)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {WORK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select name="project_owner_id" defaultValue={ownerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner">
                    {resolveOwnerLabel(ownerId, managers, viewer)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {ownerCandidates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {userDisplayName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Start</Label>
            <Input
              name="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <ProjectForecastSection
            settings={forecastSettings}
            documentCount={docCount}
            onDocumentCountChange={setDocCount}
            complexity={complexity}
            onComplexityChange={setComplexity}
            manualDueDate={manualDue}
            onManualDueDateChange={setManualDue}
            startDate={startDate || null}
            />
            </form>
          </WizardDialogScroll>
          <WizardDialogFooter>
            <Button type="submit" form="edit-project-form" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </WizardDialogFooter>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
