"use client";

import { useMemo, useState, useTransition } from "react";
import { createProjectFromTemplateAndRedirectAction } from "@/app/actions/templates";
import { TemplatePreviewPanel } from "@/components/templates/template-preview-panel";
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
import { Textarea } from "@/components/ui/textarea";
import { buildEnterpriseTemplatePreview } from "@/lib/templates/preview";
import { listTemplatesForDepartment } from "@/lib/templates/template-registry";
import {
  buildCreationDefaults,
  filterBoardProjects,
  teamIdForDepartment,
} from "@/lib/work-creation/client-defaults";
import type { EnterpriseProjectTemplate } from "@/lib/templates/enterprise-types";
import type { Department, Project, Team, User } from "@/types/flow";

export function CreateProjectFromTemplateDialog({
  open,
  onOpenChange,
  template,
  departments,
  teams,
  projects,
  managers,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EnterpriseProjectTemplate;
  departments: Department[];
  teams: Team[];
  projects: Project[];
  managers: User[];
  user: User;
}) {
  const boardProjects = filterBoardProjects(projects);
  const defaultDept = buildCreationDefaults(user, departments, teams).departmentId;

  const compatibleDepts = useMemo(() => {
    if (template.departmentIds.length === 0) return departments;
    return departments.filter((d) => template.departmentIds.includes(d.id));
  }, [template, departments]);

  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(defaultDept);
  const [ownerId, setOwnerId] = useState(managers[0]?.id ?? "__none__");
  const [boardProjectId, setBoardProjectId] = useState("__none__");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const deptName = compatibleDepts.find((d) => d.id === departmentId)?.name ?? "—";
  const preview = buildEnterpriseTemplatePreview(template, deptName);

  const deptCompatible = listTemplatesForDepartment(departmentId).some((t) => t.id === template.id);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createProjectFromTemplateAndRedirectAction({
          name: name.trim(),
          templateId: template.id,
          departmentId,
          teamId: teamIdForDepartment(departmentId, teams),
          ownerId: ownerId !== "__none__" ? ownerId : null,
          boardProjectId: boardProjectId !== "__none__" ? boardProjectId : null,
          boardName:
            boardProjectId !== "__none__"
              ? projects.find((p) => p.id === boardProjectId)?.name ?? null
              : null,
          description: description.trim() || null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create project");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create from: {template.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <TemplatePreviewPanel preview={preview} />

          <div className="space-y-2">
            <Label>Project name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 SI Library Audit"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Department *</Label>
              <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {compatibleDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!deptCompatible && (
                <p className="text-[11px] text-destructive">Template not available for this department.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Board (optional)</Label>
              <Select value={boardProjectId} onValueChange={(v) => v && setBoardProjectId(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No board</SelectItem>
                  {boardProjects.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Project owner</Label>
            <Select value={ownerId} onValueChange={(v) => v && setOwnerId(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Additional context for this project"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !name.trim() || !deptCompatible}
          >
            {pending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
