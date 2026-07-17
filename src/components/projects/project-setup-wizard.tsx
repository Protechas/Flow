"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Loader2, Sparkles } from "lucide-react";
import { createProjectFromWizardAction } from "@/app/actions/project-workspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_WORKSPACE_TEMPLATES } from "@/lib/projects/workspace-templates";
import type { ProjectTrackingFlags } from "@/lib/projects/workspace-types";
import type { Department, Team, User, WorkPriority } from "@/types/flow";
import { cn } from "@/lib/utils";

const TRACKING_OPTIONS: { key: keyof ProjectTrackingFlags; label: string }[] = [
  { key: "qaRequired", label: "QA Required" },
  { key: "fileUploads", label: "File Uploads" },
  { key: "dailyReports", label: "Daily Reports" },
  { key: "forecasting", label: "Forecasting" },
  { key: "productionTracking", label: "Production Tracking" },
  { key: "timeTracking", label: "Time Tracking" },
  { key: "wrapUps", label: "Wrap Ups" },
  { key: "customMetrics", label: "Custom Metrics" },
];

export function ProjectSetupWizard({
  user,
  departments,
  teams,
  managers,
  initialTeamId,
}: {
  user: User;
  departments: Department[];
  teams: Team[];
  managers: User[];
  /** Pre-selects the team when creating from a team lane on /projects. */
  initialTeamId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [teamId, setTeamId] = useState(initialTeamId ?? "");
  const [ownerId, setOwnerId] = useState(user.id);
  const [priority, setPriority] = useState<WorkPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("general");
  const [tracking, setTracking] = useState<ProjectTrackingFlags>(
    PROJECT_WORKSPACE_TEMPLATES.find((t) => t.id === "general")!.tracking
  );

  const teamOptions = useMemo(
    () => teams.filter((t) => !departmentId || t.department_id === departmentId),
    [teams, departmentId]
  );

  function reset() {
    setStep(0);
    setError(null);
    setName("");
    setDescription("");
    setDueDate("");
    setTemplateId("general");
    setTracking(PROJECT_WORKSPACE_TEMPLATES.find((t) => t.id === "general")!.tracking);
  }

  function selectTemplate(id: string) {
    setTemplateId(id);
    const tpl = PROJECT_WORKSPACE_TEMPLATES.find((t) => t.id === id);
    if (tpl) setTracking({ ...tpl.tracking });
  }

  function submit() {
    setError(null);
    const resolvedTeamId = teamId || teamOptions[0]?.id;
    if (!resolvedTeamId) {
      setError("Select a team for this project.");
      return;
    }
    startTransition(async () => {
      try {
        await createProjectFromWizardAction({
          name,
          departmentId,
          teamId: resolvedTeamId,
          ownerId,
          priority,
          dueDate: dueDate || null,
          description,
          templateId,
          tracking,
        });
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create project");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <FolderKanban className="mr-2 h-4 w-4" />
            New project
          </Button>
        }
      />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && "Project basics"}
            {step === 1 && "Choose template"}
            {step === 2 && "Tracking"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q3 Library Refresh"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setTeamId("");
                  }}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={teamId || teamOptions[0]?.id || ""}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Owner</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as WorkPriority)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">Due date</Label>
              <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project delivering?"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {PROJECT_WORKSPACE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => selectTemplate(tpl.id)}
                className={cn(
                  "rounded-lg border p-4 text-left transition hover:border-primary/50",
                  templateId === tpl.id && "border-primary bg-primary/5 ring-1 ring-primary/30"
                )}
              >
                <p className="font-medium">{tpl.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
                {tpl.sections.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sections: {tpl.sections.join(", ")}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose what this project tracks. Flow will auto-build KPIs and defaults from your
              selections.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRACKING_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={tracking[opt.key]}
                    onCheckedChange={(checked) =>
                      setTracking((prev) => ({ ...prev, [opt.key]: Boolean(checked) }))
                    }
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Ready to launch
              </p>
              <p className="mt-1 text-muted-foreground">
                Your workspace opens immediately with sections, task columns, and KPI cards — no
                hierarchy setup required.
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" disabled={pending || step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              disabled={pending || (step === 0 && !name.trim())}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={pending || !name.trim()} onClick={submit}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create project"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
