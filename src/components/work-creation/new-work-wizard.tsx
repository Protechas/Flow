"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createBoardAction,
  createProjectWizardAction,
  createQuickTaskAction,
} from "@/app/actions/crud";
import { createProjectFromTemplateAction } from "@/app/actions/templates";
import { TemplatePreviewPanel } from "@/components/templates/template-preview-panel";
import { CreationPreviewPanel } from "@/components/work-creation/creation-preview-panel";
import { TaskImpactReview } from "@/components/planning/task-impact-review";
import { WizardStepper } from "@/components/work-creation/wizard-stepper";
import { useFlowToast } from "@/components/ui/flow-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
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
import { Textarea } from "@/components/ui/textarea";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import { WORK_PRIORITIES } from "@/lib/constants";
import {
  buildBoardPreview,
  buildProjectPreview,
  buildTaskPreview,
} from "@/lib/work-creation/preview";
import type { CreationPreview } from "@/lib/work-creation/preview";
import {
  BOARD_TEMPLATES,
  PROJECT_WIZARD_TEMPLATES,
} from "@/lib/work-creation/templates";
import {
  buildCreationDefaults,
  filterBoardProjects,
  filterProgramProjects,
  teamIdForDepartment,
} from "@/lib/work-creation/client-defaults";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import type {
  BoardWizardState,
  ProjectWizardState,
  TaskWizardState,
  WorkCreationMode,
} from "@/lib/work-creation/types";
import type {
  Department,
  ForecastSettings,
  Project,
  Team,
  User,
  WorkPackage,
} from "@/types/flow";
import { ChevronDown, ChevronUp, FolderKanban, Kanban, ListTodo, Plus } from "lucide-react";
import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import { listEnterpriseTemplates } from "@/lib/templates/template-registry";
import { buildEnterpriseTemplatePreview } from "@/lib/templates/preview";
import {
  PROJECT_GUIDED_STEPS,
  projectMetricsPreview,
  projectQaPreview,
} from "@/lib/work-creation/project-guided-steps";

const MODE_META: Record<
  WorkCreationMode,
  { label: string; description: string; icon: typeof Kanban }
> = {
  board: {
    label: "New Board",
    description: "Operations workspace for a department or team queue",
    icon: Kanban,
  },
  project: {
    label: "New Project",
    description: "Program with forecast, reporting, and QA pipeline",
    icon: FolderKanban,
  },
  task: {
    label: "New Task",
    description: "Assign work with planning forecast to an employee",
    icon: ListTodo,
  },
};

export function NewWorkWizard({
  user,
  departments,
  teams,
  projects,
  analysts,
  managers,
  forecastSettings,
  workPackages = [],
}: {
  user: User;
  departments: Department[];
  teams: Team[];
  projects: Project[];
  analysts: User[];
  managers: User[];
  forecastSettings: ForecastSettings;
  workPackages?: WorkPackage[];
}) {
  const allowedModes = getAllowedCreationModes(user.role);
  const { toast } = useFlowToast();
  const defaults = buildCreationDefaults(user, departments, teams);
  const boardProjects = filterBoardProjects(projects);
  const programProjects = filterProgramProjects(projects);

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<WorkCreationMode>(allowedModes[0] ?? "task");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [board, setBoard] = useState<BoardWizardState>({
    templateId: "custom_board",
    name: "",
    departmentId: defaults.departmentId,
    description: "",
  });

  const enterpriseTemplates = useMemo(() => listEnterpriseTemplates(), []);

  const [project, setProject] = useState<ProjectWizardState>({
    projectCreationMode: "from_template",
    enterpriseTemplateId: "standard_production",
    templateId: "custom",
    name: "",
    departmentId: defaults.departmentId,
    boardProjectId: "__none__",
    estimatedDocuments: "",
    manualDueDate: "",
    ownerId: managers[0]?.id ?? "__none__",
    complexity: defaults.complexity,
    priority: defaults.priority,
    description: "",
  });

  const [task, setTask] = useState<TaskWizardState>({
    name: "",
    projectId: programProjects[0]?.id ?? projects[0]?.id ?? "",
    newProjectName: "",
    projectMode: programProjects.length ? "existing" : "new",
    boardProjectId: boardProjects[0]?.id ?? "__none__",
    manufacturerName: defaults.manufacturerFallback,
    year: defaults.year,
    assigneeId: "__none__",
    estimatedDocuments: "",
    complexity: defaults.complexity,
    priority: defaults.priority,
  });

  const steps = useMemo(() => {
    if (mode === "board") return ["Template", "Details", "Review"];
    if (mode === "task") return ["Details", "Review"];
    return allowedModes.length > 1 ? ["Work type", ...PROJECT_GUIDED_STEPS] : [...PROJECT_GUIDED_STEPS];
  }, [mode, allowedModes.length]);

  const projectStep =
    mode === "project" ? (allowedModes.length > 1 ? step - 1 : step) : -1;

  const selectedEnterpriseTemplate =
    enterpriseTemplates.find((t) => t.id === project.enterpriseTemplateId) ?? enterpriseTemplates[0];

  const metricsPreview = useMemo(
    () =>
      projectMetricsPreview(
        project.projectCreationMode === "from_template"
          ? project.enterpriseTemplateId
          : project.templateId,
        project.projectCreationMode === "from_template"
      ),
    [project]
  );

  const qaPreview = useMemo(
    () =>
      projectQaPreview(
        project.projectCreationMode === "from_template" ? selectedEnterpriseTemplate : null
      ),
    [project.projectCreationMode, selectedEnterpriseTemplate]
  );

  const deptName = (id: string) =>
    departments.find((d) => d.id === id)?.name ?? id;

  const preview = useMemo(() => {
    if (mode === "board") {
      return buildBoardPreview({
        name: board.name,
        departmentName: deptName(board.departmentId),
        templateId: board.templateId,
        description: board.description,
      });
    }
    if (mode === "project") {
      if (project.projectCreationMode === "from_template") {
        const tpl =
          enterpriseTemplates.find((t) => t.id === project.enterpriseTemplateId) ??
          enterpriseTemplates[0];
        if (tpl) {
          return buildEnterpriseTemplatePreview(tpl, deptName(project.departmentId));
        }
      }
      const boardName =
        project.boardProjectId !== "__none__"
          ? projects.find((p) => p.id === project.boardProjectId)?.name ?? "—"
          : "—";
      return buildProjectPreview({
        name: project.name,
        departmentName: deptName(project.departmentId),
        boardName,
        templateId: project.templateId,
        ownerName:
          managers.find((m) => m.id === project.ownerId)?.full_name ?? "Unassigned",
        docs: Number(project.estimatedDocuments) || 0,
        manualDue: project.manualDueDate || null,
        forecastSettings,
        complexity: project.complexity,
      });
    }
    const projectName =
      task.projectMode === "existing"
        ? projects.find((p) => p.id === task.projectId)?.name ?? "—"
        : task.newProjectName || "New project";
    return buildTaskPreview({
      name: task.name,
      projectName,
      assigneeName:
        analysts.find((a) => a.id === task.assigneeId)?.full_name ?? "Unassigned",
      docs: Number(task.estimatedDocuments) || 0,
      complexity: task.complexity,
      priority: task.priority,
      forecastSettings,
    });
  }, [mode, board, project, task, departments, projects, managers, analysts, forecastSettings, enterpriseTemplates]);

  function resetWizard() {
    setStep(0);
    setMode(allowedModes[0] ?? "task");
    setShowAdvanced(false);
    setBoard({
      templateId: "custom_board",
      name: "",
      departmentId: defaults.departmentId,
      description: "",
    });
    setProject({
      projectCreationMode: "from_template",
      enterpriseTemplateId: "standard_production",
      templateId: "custom",
      name: "",
      departmentId: defaults.departmentId,
      boardProjectId: "__none__",
      estimatedDocuments: "",
      manualDueDate: "",
      ownerId: managers[0]?.id ?? "__none__",
      complexity: defaults.complexity,
      priority: defaults.priority,
      description: "",
    });
    setTask({
      name: "",
      projectId: programProjects[0]?.id ?? projects[0]?.id ?? "",
      newProjectName: "",
      projectMode: programProjects.length ? "existing" : "new",
      boardProjectId: boardProjects[0]?.id ?? "__none__",
      manufacturerName: defaults.manufacturerFallback,
      year: defaults.year,
      assigneeId: "__none__",
      estimatedDocuments: "",
      complexity: defaults.complexity,
      priority: defaults.priority,
    });
  }

  function applyBoardTemplate(templateId: string) {
    const tpl = BOARD_TEMPLATES.find((t) => t.id === templateId);
    setBoard((b) => ({
      ...b,
      templateId,
      description: tpl?.purpose ?? b.description,
      name: b.name || (tpl && tpl.id !== "custom_board" ? tpl.label : ""),
    }));
  }

  function submit() {
    startTransition(async () => {
      try {
      if (mode === "board") {
        await createBoardAction({
          name: board.name,
          description: board.description,
          departmentId: board.departmentId,
          teamId: teamIdForDepartment(board.departmentId, teams),
          templateId: board.templateId,
        });
      } else if (mode === "project") {
        if (project.projectCreationMode === "from_template") {
          const boardRef =
            project.boardProjectId !== "__none__"
              ? projects.find((p) => p.id === project.boardProjectId)
              : undefined;
          const result = await createProjectFromTemplateAction({
            name: project.name,
            templateId: project.enterpriseTemplateId,
            departmentId: boardRef?.department_id ?? project.departmentId,
            teamId: boardRef?.team_id ?? teamIdForDepartment(project.departmentId, teams),
            boardProjectId: project.boardProjectId !== "__none__" ? project.boardProjectId : null,
            boardName: boardRef?.name ?? null,
            ownerId: project.ownerId,
            description: project.description || null,
          });
          if (!result.ok) {
            throw new Error(result.error);
          }
        } else {
          const boardRef =
            project.boardProjectId !== "__none__"
              ? projects.find((p) => p.id === project.boardProjectId)
              : undefined;
          await createProjectWizardAction({
            name: project.name,
            templateId: project.templateId as ProjectTemplateId,
            departmentId: boardRef?.department_id ?? project.departmentId,
            teamId: boardRef?.team_id ?? teamIdForDepartment(project.departmentId, teams),
            boardProjectId: project.boardProjectId !== "__none__" ? project.boardProjectId : null,
            boardName: boardRef?.name ?? null,
            estimatedDocuments: Number(project.estimatedDocuments) || null,
            manualDueDate: project.manualDueDate || null,
            ownerId: project.ownerId,
            complexity: project.complexity,
            priority: project.priority,
            description: project.description || null,
          });
        }
      } else {
        const boardRef =
          task.boardProjectId !== "__none__"
            ? projects.find((p) => p.id === task.boardProjectId)
            : undefined;
        await createQuickTaskAction({
          projectId: task.projectMode === "existing" ? task.projectId : null,
          newProjectName: task.projectMode === "new" ? task.newProjectName : null,
          manufacturerName: task.manufacturerName || defaults.manufacturerFallback,
          year: Number(task.year),
          taskTitle: task.name,
          assignedTo: task.assigneeId !== "__none__" ? task.assigneeId : null,
          estimatedDocumentCount: Number(task.estimatedDocuments) || null,
          complexityLevel: task.complexity,
          priority: task.priority,
        });
      }
      setOpen(false);
      resetWizard();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not create work",
          description: e instanceof Error ? e.message : "Something went wrong. Try again.",
        });
      }
    });
  }

  if (allowedModes.length === 0) return null;

  const onStep0 = step === 0;
  const onReview = step === steps.length - 1;
  const showModePick = onStep0 && allowedModes.length > 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetWizard();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New work
          </Button>
        }
      />
      <WizardDialogContent size="md">
        <WizardDialogHeader>
          <DialogTitle>New work</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Guided setup with smart defaults — Flow builds the full structure in the background.
          </p>
        </WizardDialogHeader>

        <WizardDialogBody>
          <WizardDialogScroll>
        {showModePick && (
          <div className="grid gap-2 sm:grid-cols-3">
            {allowedModes.map((m) => {
              const meta = MODE_META[m];
              const Icon = meta.icon;
              const selected = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setStep(0);
                  }}
                  className={[
                    "rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/30",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 mb-2 text-primary" />
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <WizardStepper steps={steps} current={step} />

        {/* BOARD FLOW */}
        {mode === "board" && step === 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Board template</Label>
            <div className="grid gap-2">
              {BOARD_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyBoardTemplate(tpl.id)}
                  className={[
                    "rounded-md border px-3 py-2 text-left text-sm",
                    board.templateId === tpl.id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/20",
                  ].join(" ")}
                >
                  <span className="font-medium">{tpl.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "board" && step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Board name *</Label>
              <Input
                value={board.name}
                onChange={(e) => setBoard((b) => ({ ...b, name: e.target.value }))}
                placeholder="e.g. ADAS Task Board"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={board.departmentId}
                onValueChange={(v) => v && setBoard((b) => ({ ...b, departmentId: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Defaults from your team.</p>
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Textarea
                value={board.description}
                onChange={(e) => setBoard((b) => ({ ...b, description: e.target.value }))}
                rows={3}
                placeholder="What work will this board track?"
              />
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Advanced settings
            </button>
            {showAdvanced && (
              <p className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/10">
                QA rules, notifications, and custom fields are inherited from department defaults.
                Configure them in Settings after creation.
              </p>
            )}
          </div>
        )}

        {/* PROJECT FLOW — guided 7-step creation */}
        {mode === "project" && projectStep === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project name *</Label>
              <Input
                value={project.name}
                onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Q3 SI Production"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={project.description}
                onChange={(e) => setProject((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="What outcomes should this project deliver?"
              />
            </div>
          </div>
        )}

        {mode === "project" && projectStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Department</Label>
                <Select
                  value={project.departmentId}
                  onValueChange={(v) => v && setProject((p) => ({ ...p, departmentId: v }))}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Linked board (optional)</Label>
                <Select
                  value={project.boardProjectId}
                  onValueChange={(v) => v && setProject((p) => ({ ...p, boardProjectId: v }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No board</SelectItem>
                    {boardProjects.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Project owner / lead</Label>
              <Select
                value={project.ownerId}
                onValueChange={(v) => v && setProject((p) => ({ ...p, ownerId: v }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode === "project" && projectStep === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">How do you want to start?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setProject((p) => ({
                      ...p,
                      projectCreationMode: "from_template",
                    }))
                  }
                  className={[
                    "rounded-md border px-3 py-2.5 text-left text-sm",
                    project.projectCreationMode === "from_template"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/20",
                  ].join(" ")}
                >
                  <span className="font-medium">Create from template</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Auto-generate tasks, QA, and forecasting
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProject((p) => ({
                      ...p,
                      projectCreationMode: "blank",
                    }))
                  }
                  className={[
                    "rounded-md border px-3 py-2.5 text-left text-sm",
                    project.projectCreationMode === "blank"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/20",
                  ].join(" ")}
                >
                  <span className="font-medium">Blank project</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Legacy templates or manual structure
                  </p>
                </button>
              </div>
            </div>

            {project.projectCreationMode === "from_template" ? (
              <div className="space-y-2">
                <Label className="text-xs">Enterprise template</Label>
                <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {enterpriseTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setProject((p) => ({
                          ...p,
                          enterpriseTemplateId: tpl.id,
                          name: p.name || tpl.label,
                        }))
                      }
                      className={[
                        "rounded-md border px-3 py-2 text-left text-sm",
                        project.enterpriseTemplateId === tpl.id
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/20",
                      ].join(" ")}
                    >
                      <span className="font-medium">{tpl.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {tpl.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {tpl.tasks.length} tasks · {tpl.category}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Legacy project template</Label>
                <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {PROJECT_WIZARD_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setProject((p) => ({
                          ...p,
                          templateId: tpl.id,
                          name: p.name || (tpl.id !== "custom" ? tpl.label : ""),
                        }))
                      }
                      className={[
                        "rounded-md border px-3 py-2 text-left text-sm",
                        project.templateId === tpl.id
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/20",
                      ].join(" ")}
                    >
                      <span className="font-medium">{tpl.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "project" && projectStep === 3 && (
          <div className="space-y-4">
            {project.projectCreationMode === "blank" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Est. total documents</Label>
                    <Input
                      type="number"
                      min={0}
                      value={project.estimatedDocuments}
                      onChange={(e) =>
                        setProject((p) => ({ ...p, estimatedDocuments: e.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Complexity</Label>
                    <Select
                      value={project.complexity}
                      onValueChange={(v) =>
                        v && setProject((p) => ({ ...p, complexity: v as typeof p.complexity }))
                      }
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMPLEXITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Manual due date</Label>
                    <Input
                      type="date"
                      value={project.manualDueDate}
                      onChange={(e) =>
                        setProject((p) => ({ ...p, manualDueDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={project.priority}
                      onValueChange={(v) =>
                        v && setProject((p) => ({ ...p, priority: v as typeof p.priority }))
                      }
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WORK_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-border/60 bg-muted/10 p-4 text-sm space-y-2">
                <p className="font-medium">Forecasting from template</p>
                <p className="text-muted-foreground text-xs">
                  {selectedEnterpriseTemplate?.forecastingEnabled
                    ? "Planning forecast, due dates, and confidence will be generated from template tasks and defaults."
                    : "This template does not enable forecasting — you can add estimates after creation."}
                </p>
                {selectedEnterpriseTemplate?.defaultEstimatedDocuments ? (
                  <p className="text-xs">
                    Default documents: {selectedEnterpriseTemplate.defaultEstimatedDocuments.toLocaleString()}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}

        {mode === "project" && projectStep === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Custom metrics that will be tracked for this project (optional — add more later in project settings).
            </p>
            {metricsPreview.length > 0 ? (
              <ul className="rounded-md border border-border/60 divide-y divide-border/40">
                {metricsPreview.map((name) => (
                  <li key={name} className="px-3 py-2 text-sm">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                No default metrics for this template. Add custom metrics after creation.
              </p>
            )}
          </div>
        )}

        {mode === "project" && projectStep === 5 && (
          <div className="space-y-3">
            <div className="rounded-md border border-border/60 bg-muted/10 p-4 text-sm space-y-2">
              <p className="font-medium">QA & file requirements</p>
              <p className="text-xs text-muted-foreground">
                QA enabled: {qaPreview.qaEnabled ? "Yes" : "No"} · Files required:{" "}
                {qaPreview.fileUploadsRequired ? "Yes" : "No"} · Template tasks: {qaPreview.taskCount}
              </p>
              {qaPreview.qaTasks.length > 0 && (
                <ul className="text-xs list-disc pl-4 space-y-1">
                  {qaPreview.qaTasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* TASK FLOW */}
        {mode === "task" && step === (allowedModes.length > 1 ? 1 : 0) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task name *</Label>
              <Input
                value={task.name}
                onChange={(e) => setTask((t) => ({ ...t, name: e.target.value }))}
                placeholder="e.g. TYT 2026 SF Build"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Project</Label>
              <Select
                value={task.projectMode}
                onValueChange={(v) => v && setTask((t) => ({ ...t, projectMode: v as "existing" | "new" }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Existing project</SelectItem>
                  <SelectItem value="new">New project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {task.projectMode === "existing" ? (
              <Select value={task.projectId} onValueChange={(v) => v && setTask((t) => ({ ...t, projectId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.filter((p) => p.status === "active").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={task.newProjectName}
                onChange={(e) => setTask((t) => ({ ...t, newProjectName: e.target.value }))}
                placeholder="New project name"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Assign to</Label>
                <Select
                  value={task.assigneeId}
                  onValueChange={(v) => setTask((t) => ({ ...t, assigneeId: v ?? "__none__" }))}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {analysts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Est. documents</Label>
                <Input
                  type="number"
                  min={0}
                  value={task.estimatedDocuments}
                  onChange={(e) =>
                    setTask((t) => ({ ...t, estimatedDocuments: e.target.value }))
                  }
                  placeholder="180"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Complexity</Label>
                <Select
                  value={task.complexity}
                  onValueChange={(v) =>
                    v && setTask((t) => ({ ...t, complexity: v as typeof t.complexity }))
                  }
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPLEXITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={task.priority}
                  onValueChange={(v) =>
                    v && setTask((t) => ({ ...t, priority: v as typeof t.priority }))
                  }
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Advanced settings
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 border rounded-md p-3 bg-muted/10">
                <div className="space-y-2">
                  <Label className="text-xs">Manufacturer</Label>
                  <Input
                    value={task.manufacturerName}
                    onChange={(e) =>
                      setTask((t) => ({ ...t, manufacturerName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    value={task.year}
                    onChange={(e) => setTask((t) => ({ ...t, year: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {onReview &&
          (mode === "project" &&
          project.projectCreationMode === "from_template" &&
          "templateName" in preview ? (
            <TemplatePreviewPanel preview={preview} />
          ) : (
            <div className="space-y-4">
              <CreationPreviewPanel preview={preview as CreationPreview} />
              {mode === "task" && (
                <TaskImpactReview
                  title={task.name}
                  documentCount={Number(task.estimatedDocuments) || 0}
                  complexity={task.complexity}
                  departmentId={
                    task.projectMode === "existing"
                      ? projects.find((p) => p.id === task.projectId)?.department_id
                      : undefined
                  }
                  projectId={task.projectMode === "existing" ? task.projectId : null}
                  assigneeId={task.assigneeId !== "__none__" ? task.assigneeId : null}
                  viewer={user}
                  users={analysts}
                  packages={workPackages}
                  projects={projects}
                  teams={teams.map((t) => ({ id: t.id, department_id: t.department_id ?? "" }))}
                  settings={forecastSettings}
                  departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                />
              )}
            </div>
          ))}

          </WizardDialogScroll>

          <WizardDialogFooter className="gap-2 sm:gap-0">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              Back
            </Button>
          )}
          {!onReview ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                pending ||
                (mode === "board" && step === (allowedModes.length > 1 ? 2 : 1) && !board.name.trim()) ||
                (mode === "project" && projectStep === 0 && !project.name.trim()) ||
                (mode === "task" &&
                  step === (allowedModes.length > 1 ? 1 : 0) &&
                  !task.name.trim())
              }
            >
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Creating…" : "Create work"}
            </Button>
          )}
          </WizardDialogFooter>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
