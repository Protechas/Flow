"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuickTaskAction } from "@/app/actions/crud";
import { useFlowToast } from "@/components/ui/flow-toast";
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
import { EntitySelectValue, OptionSelectValue } from "@/components/ui/entity-select-value";
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
import { WORK_PRIORITIES } from "@/lib/constants";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import { calculateTaskForecast, formatForecastDays } from "@/lib/forecast/engine";
import { filterProgramProjects, projectTargetLabel, workTargetProjects } from "@/lib/work-creation/client-defaults";
import { parseBoardTaskDefaults } from "@/lib/work-creation/board-defaults";
import { operationsHref } from "@/lib/navigation/deep-links";
import {
  inferTaskPlacement,
  loadPlacementMemory,
  placementPreviewLine,
  savePlacementMemory,
  workstreamsForProject,
  yearsForWorkstream,
} from "@/lib/work-creation/task-placement";
import { getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { taskPlacementVisible } from "@/lib/operating-models/context";
import { getHierarchyLabels } from "@/lib/work-packages/smart-labels";
import { userDisplayName } from "@/lib/users/display-name";
import type {
  ForecastComplexityLevel,
  ForecastSettings,
  Manufacturer,
  Project,
  User,
  WorkPriority,
  YearWorkItem,
} from "@/types/flow";
import { ChevronDown, ChevronUp, ListTodo } from "lucide-react";

const SELECT_TRIGGER = "w-full min-w-0";

export interface CreateTaskComposerProps {
  user: User;
  projects: Project[];
  manufacturers?: Manufacturer[];
  yearItems?: YearWorkItem[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  defaultProjectId?: string;
  presetWorkstream?: string;
  presetYear?: number;
  defaultAssigneeId?: string;
  requireAssignee?: boolean;
  /** Controlled open state (hides default trigger when set with hideTrigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  trigger?: React.ReactElement | null;
  /** After create, navigate to Operations filtered to the task's project. */
  redirectToOperationsOnCreate?: boolean;
  /** Team operating model — controls visible fields and defaults. */
  operatingContext?: import("@/lib/operating-models/types").OperatingContext;
}

export function CreateTaskComposer({
  user,
  projects,
  manufacturers = [],
  yearItems = [],
  analysts,
  forecastSettings,
  defaultProjectId,
  presetWorkstream,
  presetYear,
  defaultAssigneeId,
  requireAssignee = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
  trigger,
  redirectToOperationsOnCreate = false,
  operatingContext,
}: CreateTaskComposerProps) {
  const { toast } = useFlowToast();
  const router = useRouter();
  const activeProjects = useMemo(() => {
    const targeted = workTargetProjects(projects, user.role);
    if (targeted.length) return targeted;
    return filterProgramProjects(projects).length
      ? filterProgramProjects(projects)
      : projects.filter((p) => p.status === "active");
  }, [projects, user.role]);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? activeProjects[0]?.id ?? ""
  );
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? "__none__");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDocs, setEstimatedDocs] = useState("");
  const [workstream, setWorkstream] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [placementTouched, setPlacementTouched] = useState(false);
  const [showPlacement, setShowPlacement] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [priority, setPriority] = useState<WorkPriority>("medium");
  const [complexity, setComplexity] = useState<ForecastComplexityLevel>("standard");
  const [qaRequired, setQaRequired] = useState(true);
  const [filesRequired, setFilesRequired] = useState(false);
  const [notes, setNotes] = useState("");
  const [inheritedBoardDefaults, setInheritedBoardDefaults] = useState(false);

  const project = activeProjects.find((p) => p.id === projectId) ?? null;
  const labels = project ? getProjectHierarchyLabels(project) : getProjectHierarchyLabels({});
  const placementVisibility = useMemo(
    () =>
      operatingContext
        ? taskPlacementVisible(operatingContext)
        : { showWorkstream: true, showYear: true },
    [operatingContext]
  );
  const tracksDocuments =
    !operatingContext || operatingContext.model.trackingFields.includes("documents");
  const tracksRecords =
    !operatingContext || operatingContext.model.trackingFields.includes("records");
  const estimateLabel = tracksDocuments
    ? "Work estimate (documents)"
    : tracksRecords
      ? "Work estimate (records)"
      : "Work estimate (units)";
  const showPlacementSection =
    placementVisibility.showWorkstream || placementVisibility.showYear;

  const inferred = useMemo(
    () =>
      inferTaskPlacement({
        project,
        taskTitle: name,
        manufacturers,
        yearItems,
        presetWorkstream: presetWorkstream ?? null,
        presetYear: presetYear ?? null,
        memory: projectId ? loadPlacementMemory(projectId) : null,
      }),
    [project, name, manufacturers, yearItems, presetWorkstream, presetYear, projectId, open]
  );

  useEffect(() => {
    if (!open || placementTouched) return;
    setWorkstream(inferred.workstream);
    setYear(String(inferred.year));
  }, [inferred, open, placementTouched]);

  useEffect(() => {
    if (!open || !operatingContext) return;
    const td = operatingContext.model.taskDefaults;
    if (td?.qaRequired != null) setQaRequired(td.qaRequired);
    if (td?.filesRequired != null) setFilesRequired(td.filesRequired);
  }, [open, operatingContext]);

  useEffect(() => {
    if (!open || !project) return;
    const boardDefaults = parseBoardTaskDefaults(project);
    if (!boardDefaults) {
      setInheritedBoardDefaults(false);
      return;
    }
    setQaRequired(boardDefaults.qaRequired);
    setFilesRequired(boardDefaults.filesRequired);
    setInheritedBoardDefaults(true);
    if (!placementTouched && !presetWorkstream) {
      setWorkstream(boardDefaults.defaultWorkstream);
    }
  }, [open, project, projectId, placementTouched, presetWorkstream]);

  const workstreamOptions = useMemo(
    () => workstreamsForProject(projectId, manufacturers),
    [projectId, manufacturers]
  );

  const yearOptions = useMemo(
    () =>
      yearsForWorkstream(projectId, workstream || "General", manufacturers, yearItems).map(
        String
      ),
    [projectId, workstream, manufacturers, yearItems]
  );

  const previewLine = placementPreviewLine(
    labels,
    workstream || inferred.workstream,
    parseInt(year, 10) || inferred.year,
    name
  );

  const forecastSnippet = useMemo(() => {
    const docs = Number(estimatedDocs) || 0;
    if (docs <= 0) return null;
    const f = calculateTaskForecast(
      {
        estimated_document_count: docs,
        complexity_level: complexity,
        start_date: new Date().toISOString().split("T")[0],
        manual_due_date: dueDate || null,
      },
      { settings: forecastSettings }
    );
    if (!f.estimated_work_hours) return null;
    return {
      hours: f.estimated_work_hours,
      days: f.estimated_work_days,
      suggestedDue: f.suggested_due_date,
    };
  }, [estimatedDocs, complexity, dueDate, forecastSettings]);

  function reset() {
    setName("");
    setProjectId(defaultProjectId ?? activeProjects[0]?.id ?? "");
    setAssigneeId(defaultAssigneeId ?? "__none__");
    setDueDate("");
    setEstimatedDocs("");
    setWorkstream(presetWorkstream ?? "");
    setYear(String(presetYear ?? new Date().getFullYear()));
    setPlacementTouched(Boolean(presetWorkstream || presetYear));
    setShowPlacement(Boolean(presetWorkstream || presetYear));
    setShowAdvanced(false);
    setPriority("medium");
    setComplexity("standard");
    setQaRequired(true);
    setFilesRequired(false);
    setInheritedBoardDefaults(false);
    setNotes("");
  }

  function submit() {
    if (!name.trim()) {
      toast({ variant: "error", title: "Task name is required" });
      return;
    }
    if (!projectId) {
      toast({ variant: "error", title: "Select a project" });
      return;
    }
    if (requireAssignee && assigneeId === "__none__") {
      toast({ variant: "error", title: "Select an assignee" });
      return;
    }

    const ws = workstream.trim() || inferred.workstream;
    const yr = parseInt(year, 10) || inferred.year;
    const flagNotes = [
      notes.trim() || null,
      qaRequired ? "QA required" : null,
      filesRequired ? "Files required" : null,
    ]
      .filter(Boolean)
      .join("\n");

    startTransition(async () => {
      try {
        await createQuickTaskAction({
          projectId,
          manufacturerName: ws,
          year: yr,
          taskTitle: name.trim(),
          assignedTo: assigneeId !== "__none__" ? assigneeId : null,
          estimatedDocumentCount: Number(estimatedDocs) || null,
          complexityLevel: complexity,
          priority,
          manualDueDate: dueDate || null,
          notes: flagNotes || null,
          qaRequired,
          filesRequired,
        });
        savePlacementMemory(projectId, ws, yr);
        toast({
          variant: "success",
          title: "Task created",
          description: previewLine,
        });
        setOpen(false);
        reset();
        if (redirectToOperationsOnCreate) {
          router.push(operationsHref({ grouping: "by_program", projectId }));
        }
        router.refresh();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not create task",
          description: e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
        else if (defaultProjectId) setProjectId(defaultProjectId);
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm" className="h-8">
                <ListTodo className="h-3.5 w-3.5 mr-1.5" />
                Create task
              </Button>
            )
          }
        />
      )}
      <WizardDialogContent size="lg">
        <WizardDialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Add work in seconds — Flow places it in the right project structure for
            reporting, forecast, and QA.
          </p>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll className="space-y-5 pr-1">
            <div className="space-y-2">
              <Label>Task name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Toyota 2026 Camry validation"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Project *</Label>
                <Select
                  value={projectId}
                  onValueChange={(v) => {
                    if (v) {
                      setProjectId(v);
                      setPlacementTouched(false);
                    }
                  }}
                >
                  <SelectTrigger className={SELECT_TRIGGER}>
                    <EntitySelectValue
                      value={projectId}
                      items={activeProjects}
                      getLabel={projectTargetLabel}
                      placeholder="Select project"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {projectTargetLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Assignee{requireAssignee ? " *" : ""}</Label>
                <Select value={assigneeId} onValueChange={(v) => v && setAssigneeId(v)}>
                  <SelectTrigger className={SELECT_TRIGGER}>
                    <EntitySelectValue
                      value={assigneeId}
                      items={analysts}
                      getLabel={(a) => userDisplayName(a)}
                      placeholder="Unassigned"
                      sentinels={[{ value: "__none__", label: "Unassigned" }]}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {analysts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {userDisplayName(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              {(tracksDocuments || tracksRecords || !operatingContext) && (
                <div className="space-y-2 min-w-0">
                  <Label>{estimateLabel}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={estimatedDocs}
                    onChange={(e) => setEstimatedDocs(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              )}
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Will create
              </p>
              <p className="font-medium font-mono text-xs sm:text-sm">{previewLine}</p>
              {forecastSnippet && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  ~{forecastSnippet.hours}h ({formatForecastDays(forecastSnippet.days ?? 0)} work
                  days)
                  {forecastSnippet.suggestedDue
                    ? ` · suggested due ${forecastSnippet.suggestedDue}`
                    : null}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Reporting, forecast, QA, and files attach to this path automatically.
              </p>
            </div>

            {showPlacementSection && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowPlacement((v) => !v)}
              >
                {showPlacement ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Placement — {labels.workPackageShort}
                {placementVisibility.showYear ? ` & ${labels.phaseShort}` : ""}
                {!placementTouched && inferred.source !== "fallback" && (
                  <span className="text-primary ml-1">(auto)</span>
                )}
              </button>
              {showPlacement && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 rounded-md border bg-muted/10">
                  {placementVisibility.showWorkstream && (
                  <div className="space-y-2 min-w-0">
                    <Label className="text-xs">{labels.workPackage}</Label>
                    {workstreamOptions.length > 1 ? (
                      <Select
                        value={workstreamOptions.includes(workstream) ? workstream : "__custom__"}
                        onValueChange={(v) => {
                          setPlacementTouched(true);
                          if (v === "__custom__") setWorkstream("");
                          else if (v) setWorkstream(v);
                        }}
                      >
                        <SelectTrigger className={SELECT_TRIGGER}>
                          <SelectValue placeholder={`Select ${labels.workPackageShort}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {workstreamOptions.map((ws) => (
                            <SelectItem key={ws} value={ws}>
                              {ws}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">Custom name…</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                    <Input
                      value={workstream}
                      onChange={(e) => {
                        setPlacementTouched(true);
                        setWorkstream(e.target.value);
                      }}
                      placeholder={labels.workPackageShort}
                    />
                  </div>
                  )}
                  {placementVisibility.showYear && (
                  <div className="space-y-2 min-w-0">
                    <Label className="text-xs">{labels.phase}</Label>
                    <Select
                      value={year}
                      onValueChange={(v) => {
                        if (v) {
                          setPlacementTouched(true);
                          setYear(v);
                        }
                      }}
                    >
                      <SelectTrigger className={SELECT_TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                </div>
              )}
            </div>
            )}

            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Advanced tracking
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-3 p-3 rounded-md border bg-muted/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Priority</Label>
                      <Select
                        value={priority}
                        onValueChange={(v) => v && setPriority(v as WorkPriority)}
                      >
                        <SelectTrigger className={SELECT_TRIGGER}>
                          <OptionSelectValue value={priority} options={WORK_PRIORITIES} />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Complexity</Label>
                      <Select
                        value={complexity}
                        onValueChange={(v) => v && setComplexity(v as ForecastComplexityLevel)}
                      >
                        <SelectTrigger className={SELECT_TRIGGER}>
                          <OptionSelectValue value={complexity} options={COMPLEXITY_OPTIONS} />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPLEXITY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={qaRequired}
                        onChange={(e) => {
                          setQaRequired(e.target.checked);
                          setInheritedBoardDefaults(false);
                        }}
                      />
                      QA required
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filesRequired}
                        onChange={(e) => {
                          setFilesRequired(e.target.checked);
                          setInheritedBoardDefaults(false);
                        }}
                      />
                      Files required
                    </label>
                    {inheritedBoardDefaults && (
                      <span className="text-xs text-muted-foreground self-center">
                        Inherited from board defaults
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Instructions, file types, dependencies…"
                    />
                  </div>
                </div>
              )}
            </div>
          </WizardDialogScroll>
        </WizardDialogBody>
        <WizardDialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create task"}
          </Button>
        </WizardDialogFooter>
      </WizardDialogContent>
    </Dialog>
  );
}
