"use client";

import { useMemo, useState, useTransition } from "react";
import { createWorkPackageAction } from "@/app/actions/crud";
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
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { userDisplayName } from "@/lib/users/display-name";
import { getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import { calculateTaskForecast, formatForecastDays } from "@/lib/forecast/engine";
import { useLiveForecastSettings } from "@/lib/forecast/use-live-forecast-settings";
import { TaskImpactReview } from "@/components/planning/task-impact-review";
import { useOperationsPlanning } from "@/components/operations/operations-planning-context";
import type {
  ForecastComplexityLevel,
  ForecastSettings,
  Project,
  Team,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { Plus } from "lucide-react";
import { useFlowToast } from "@/components/ui/flow-toast";

export function AddWorkPackageDialog({
  yearItem,
  manufacturerName,
  analysts,
  forecastSettings,
  trigger,
  viewer,
  workPackages = [],
  projects = [],
  teams = [],
  departments = [],
}: {
  yearItem: YearWorkItem;
  manufacturerName?: string;
  analysts: User[];
  forecastSettings: ForecastSettings;
  trigger?: React.ReactElement;
  viewer?: User;
  workPackages?: WorkPackage[];
  projects?: Project[];
  teams?: Team[];
  departments?: { id: string; name: string }[];
}) {
  const planningCtx = useOperationsPlanning();
  const resolvedViewer = viewer ?? planningCtx?.viewer;
  const resolvedPackages = workPackages.length > 0 ? workPackages : (planningCtx?.workPackages ?? []);
  const resolvedProjects = projects.length > 0 ? projects : (planningCtx?.projects ?? []);
  const resolvedTeams = teams.length > 0 ? teams : (planningCtx?.teams ?? []);
  const resolvedDepartments =
    departments.length > 0 ? departments : (planningCtx?.departments ?? []);

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmStep, setConfirmStep] = useState(false);
  const [docCount, setDocCount] = useState("");
  const [complexity, setComplexity] = useState<ForecastComplexityLevel>("standard");
  const [assignee, setAssignee] = useState(yearItem.assigned_to ?? "__none__");
  const [taskTitle, setTaskTitle] = useState("");
  const { toast } = useFlowToast();

  const project = resolvedProjects.find((p) => p.id === yearItem.project_id);
  const labels = project ? getProjectHierarchyLabels(project) : getProjectHierarchyLabels({});
  const mfr = manufacturerName ?? labels.workPackageShort;
  const defaultTitle = `${mfr} ${yearItem.year}`;
  const title = taskTitle.trim() || defaultTitle;

  const settings = useLiveForecastSettings(forecastSettings);
  const docs = Number(docCount) || 0;
  const forecast = useMemo(
    () =>
      calculateTaskForecast(
        {
          estimated_document_count: docs > 0 ? docs : null,
          complexity_level: complexity,
          start_date: new Date().toISOString().split("T")[0],
          manual_due_date: null,
          due_date: null,
        },
        { settings }
      ),
    [docs, complexity, settings]
  );

  const departmentId = project?.department_id ?? undefined;
  const planningDue =
    docs > 0 && forecast.suggested_due_date
      ? forecast.suggested_due_date
      : yearItem.due_date;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmStep(false);
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add {labels.task.toLowerCase()}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {labels.task.toLowerCase()}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {mfr} · {yearItem.year}
          </p>
        </DialogHeader>
        {!confirmStep ? (
          <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Assign to</Label>
            <Select value={assignee} onValueChange={(v) => setAssignee(v ?? "__none__")}>
              <SelectTrigger className="h-9">
                <EntitySelectValue
                  value={assignee}
                  items={analysts}
                  getLabel={userDisplayName}
                  placeholder="Unassigned"
                  sentinels={[{ value: "__none__", label: "Unassigned" }]}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {analysts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">Est. documents</Label>
              <Input
                type="number"
                min={0}
                value={docCount}
                onChange={(e) => setDocCount(e.target.value)}
                placeholder="180"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Complexity</Label>
              <Select
                value={complexity}
                onValueChange={(v) => v && setComplexity(v as ForecastComplexityLevel)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {COMPLEXITY_OPTIONS.find((o) => o.value === complexity)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Title (optional)</Label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => setConfirmStep(true)}>
              Review impact
            </Button>
          </DialogFooter>
          </div>
        ) : (
          <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              try {
                if (!title.trim()) throw new Error("Task name is required.");
                await createWorkPackageAction({
                  project_id: yearItem.project_id,
                  manufacturer_id: yearItem.manufacturer_id,
                  year_work_item_id: yearItem.id,
                  year: yearItem.year,
                  title,
                  assigned_to: assignee && assignee !== "__none__" ? assignee : null,
                  status: assignee && assignee !== "__none__" ? "assigned" : "not_started",
                  priority: yearItem.priority,
                  due_date: planningDue,
                  manual_due_date: docs > 0 ? forecast.suggested_due_date : null,
                  estimated_hours: yearItem.estimated_hours ?? 8,
                  estimated_document_count: docs > 0 ? docs : null,
                  complexity_level: complexity,
                  notes: null,
                });
                toast({ variant: "success", title: "Task created", description: title });
                setOpen(false);
                setConfirmStep(false);
                setDocCount("");
                setTaskTitle("");
                setAssignee(yearItem.assigned_to ?? "__none__");
                setComplexity("standard");
              } catch (e) {
                toast({
                  variant: "error",
                  title: "Could not create task",
                  description: e instanceof Error ? e.message : "Something went wrong.",
                });
              }
            });
          }}
        >
          {resolvedViewer ? (
            <TaskImpactReview
              title={title}
              documentCount={docs}
              complexity={complexity}
              departmentId={departmentId}
              projectId={yearItem.project_id}
              assigneeId={assignee !== "__none__" ? assignee : null}
              viewer={resolvedViewer}
              users={analysts}
              packages={resolvedPackages}
              projects={resolvedProjects}
              teams={resolvedTeams.map((t) => ({ id: t.id, department_id: t.department_id ?? "" }))}
              settings={settings}
              departments={resolvedDepartments.map((d) => ({ id: d.id, name: d.name }))}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Planning due for <strong className="text-foreground">{title}</strong>:{" "}
              {forecast.suggested_due_date ?? "—"}
              {forecast.estimated_work_days != null && ` · ${formatForecastDays(forecast.estimated_work_days)}`}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmStep(false)}>
              Back
            </Button>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Creating…" : "Confirm & create task"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
