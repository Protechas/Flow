"use client";

import { useState, useTransition } from "react";
import { createProjectAction } from "@/app/actions/crud";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { PROJECT_STATUSES, PROJECT_TYPES, WORK_PRIORITIES } from "@/lib/constants";
import { PROJECT_TEMPLATES, type ProjectTemplateId } from "@/lib/templates/project-templates";
import type { User } from "@/types/flow";
import { Plus } from "lucide-react";

export function NewProjectDialog({ managers }: { managers: User[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [template, setTemplate] = useState<ProjectTemplateId>("custom");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createProjectAction(
        {
          name: fd.get("name") as string,
          description: (fd.get("description") as string) || null,
          project_type: fd.get("project_type") as string,
          status: fd.get("status") as string,
          priority: fd.get("priority") as import("@/types/flow").WorkPriority,
          start_date: (fd.get("start_date") as string) || null,
          due_date: (fd.get("due_date") as string) || null,
          project_owner_id: (fd.get("project_owner_id") as string) || null,
        },
        template
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-violet-600 hover:bg-violet-700" />}>
        <Plus className="h-4 w-4 mr-2" />
        New Project
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={template} onValueChange={(v) => v && setTemplate(v as ProjectTemplateId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PROJECT_TEMPLATES.find((t) => t.id === template)?.description}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Project name *</Label>
            <Input id="name" name="name" required placeholder="e.g. SF Phase 1 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project type</Label>
              <Select name="project_type" defaultValue={PROJECT_TEMPLATES.find((t) => t.id === template)?.projectType ?? "custom"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="active">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project owner</Label>
              <Select name="project_owner_id" defaultValue={managers[0]?.id ?? "__none__"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create Project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
