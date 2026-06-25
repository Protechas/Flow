"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBulkMatrixProjectAction } from "@/app/actions/bulk-matrix-creation";
import { createProjectWithStructureAction } from "@/app/actions/project-structure";
import { BulkMatrixPreviewPanel } from "@/components/work-creation/bulk-matrix-preview-panel";
import {
  MatrixDimensionPicker,
  YearDimensionPicker,
} from "@/components/work-creation/matrix-dimension-picker";
import { StructurePreviewPanel } from "@/components/work-creation/structure-preview-panel";
import { WorkPackageBulkPicker } from "@/components/work-creation/work-package-bulk-picker";
import { WizardStepper } from "@/components/work-creation/wizard-stepper";
import { useFlowToast } from "@/components/ui/flow-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EntitySelectValue, OptionSelectValue } from "@/components/ui/entity-select-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { PROJECT_TYPES } from "@/lib/constants";
import { buildBulkMatrixPreview } from "@/lib/work-creation/bulk-matrix-preview";
import {
  BULK_MATRIX_ORDER_OPTIONS,
  COMMON_MATRIX_YEARS,
  emptyBulkMatrixDraft,
  type BulkMatrixDraft,
} from "@/lib/work-creation/bulk-matrix-types";
import {
  buildCreationDefaults,
  defaultProjectOwnerId,
  projectOwnerCandidates,
  teamIdForDepartment,
} from "@/lib/work-creation/client-defaults";
import {
  emptyPackageDraft,
  emptyProjectCreationDraft,
  type ProjectCreationDraft,
} from "@/lib/work-creation/project-structure-types";
import {
  defaultMatrixYears,
  getProgramBlueprintOrDefault,
  PROGRAM_BLUEPRINTS,
  structureModeForBlueprint,
  type ProgramBlueprint,
} from "@/lib/work-creation/program-blueprints";
import { COMMON_WORK_PACKAGE_NAMES } from "@/lib/work-creation/suggested-work-packages";
import { sortLabels, sortNumbers } from "@/lib/work-creation/sort-labels";
import { countResolvedTasksForDraft } from "@/lib/work-creation/resolve-package-tasks";
import { structureDraftFromEnterpriseTemplate } from "@/lib/work-creation/enterprise-template-draft";
import { buildStructurePreview } from "@/lib/work-creation/structure-preview";
import { getEnterpriseTemplate, listEnterpriseTemplates } from "@/lib/templates/template-registry";
import { getHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { WORK_STRUCTURE_OPTIONS } from "@/lib/work-packages/smart-labels";
import type { Department, ForecastSettings, Team, User } from "@/types/flow";
import { userDisplayName } from "@/lib/users/display-name";
import { Layers3, LayoutTemplate, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Choose blueprint", "Configure program", "Review & create"] as const;
const SELECT_TRIGGER = "w-full min-w-0";

function packagesFromBlueprint(blueprint: ProgramBlueprint): ProjectCreationDraft["packages"] {
  if (blueprint.presetPackages?.length) {
    const phases = (blueprint.presetPhases ?? [new Date().getFullYear()]).map((y) => ({
      label: String(y),
    }));
    return blueprint.presetPackages.map((name) => ({
      ...emptyPackageDraft(),
      name,
      phases,
      taskSetupMode: blueprint.defaultTaskSetup ?? "manual",
    }));
  }
  return [emptyPackageDraft()];
}

function matrixFromBlueprint(
  blueprint: ProgramBlueprint,
  defaults: ReturnType<typeof buildCreationDefaults>,
  ownerId: string
): BulkMatrixDraft {
  return {
    ...emptyBulkMatrixDraft({
      departmentId: defaults.departmentId,
      teamId: defaults.teamId,
      ownerId,
      projectType: blueprint.projectType,
      templateId: blueprint.templateId,
      matrixOrder: blueprint.matrixOrder ?? "make_year_model",
      selectedMakes: blueprint.presetMakes ?? [],
      selectedYears: defaultMatrixYears(),
    }),
    name: blueprint.label,
  };
}

function structureFromBlueprint(
  blueprint: ProgramBlueprint,
  defaults: ReturnType<typeof buildCreationDefaults>,
  ownerId: string
): ProjectCreationDraft {
  return {
    ...emptyProjectCreationDraft(),
    departmentId: defaults.departmentId,
    teamId: defaults.teamId,
    ownerId,
    projectType: blueprint.projectType,
    templateId: blueprint.templateId,
    structureMode: structureModeForBlueprint(blueprint),
    name: blueprint.id === "custom_program" ? "" : blueprint.label,
    packages: packagesFromBlueprint(blueprint),
  };
}

export function ProgramBuilder({
  user,
  departments,
  teams,
  managers,
  forecastSettings,
}: {
  user: User;
  departments: Department[];
  teams: Team[];
  managers: User[];
  forecastSettings: ForecastSettings;
}) {
  const { toast } = useFlowToast();
  const router = useRouter();
  const defaults = buildCreationDefaults(user, departments, teams);
  const ownerCandidates = useMemo(
    () => projectOwnerCandidates(managers, user),
    [managers, user]
  );
  const defaultOwnerId = useMemo(
    () => defaultProjectOwnerId(user, managers),
    [managers, user]
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [blueprintId, setBlueprintId] = useState("custom_program");
  const [enterpriseTemplateId, setEnterpriseTemplateId] = useState<string | null>(null);
  const blueprint = getProgramBlueprintOrDefault(blueprintId);
  const enterpriseTemplates = useMemo(() => listEnterpriseTemplates(), []);

  const [structureDraft, setStructureDraft] = useState<ProjectCreationDraft>(() =>
    structureFromBlueprint(getProgramBlueprintOrDefault("custom_program"), defaults, defaultOwnerId)
  );
  const [matrixDraft, setMatrixDraft] = useState<BulkMatrixDraft>(() =>
    matrixFromBlueprint(getProgramBlueprintOrDefault("make_year_model_matrix"), defaults, defaultOwnerId)
  );
  const [bulkCustomNames, setBulkCustomNames] = useState<string[]>([]);
  const [customMakes, setCustomMakes] = useState<string[]>([]);
  const [customYears, setCustomYears] = useState<number[]>([]);

  const labels = getHierarchyLabels(
    blueprint.kind === "structure" ? structureDraft.projectType : matrixDraft.projectType,
    blueprint.kind === "structure" ? structureDraft.structureMode : structureModeForBlueprint(blueprint)
  );

  const filteredTeams = useMemo(
    () =>
      structureDraft.departmentId
        ? teams.filter((t) => t.department_id === structureDraft.departmentId)
        : teams,
    [teams, structureDraft.departmentId]
  );

  const matrixFilteredTeams = useMemo(
    () =>
      matrixDraft.departmentId
        ? teams.filter((t) => t.department_id === matrixDraft.departmentId)
        : teams,
    [teams, matrixDraft.departmentId]
  );

  const structurePreview = useMemo(
    () => buildStructurePreview(structureDraft),
    [structureDraft]
  );

  const matrixPreview = useMemo(
    () => buildBulkMatrixPreview(matrixDraft, forecastSettings),
    [matrixDraft, forecastSettings]
  );

  const selectedPackageNames = useMemo(
    () => structureDraft.packages.map((p) => p.name).filter(Boolean),
    [structureDraft.packages]
  );

  function reset() {
    setStep(0);
    setBlueprintId("custom_program");
    setEnterpriseTemplateId(null);
    setBulkCustomNames([]);
    setCustomMakes([]);
    setCustomYears([]);
    setStructureDraft(structureFromBlueprint(getProgramBlueprintOrDefault("custom_program"), defaults, defaultOwnerId));
    setMatrixDraft(
      matrixFromBlueprint(getProgramBlueprintOrDefault("make_year_model_matrix"), defaults, defaultOwnerId)
    );
  }

  function selectBlueprint(id: string) {
    setEnterpriseTemplateId(null);
    const bp = getProgramBlueprintOrDefault(id);
    setBlueprintId(id);
    if (bp.kind === "structure") {
      const draft = structureFromBlueprint(bp, defaults, defaultOwnerId);
      const estTasks = countResolvedTasksForDraft(draft);
      setStructureDraft({
        ...draft,
        tracking: {
          ...draft.tracking,
          estimatedHours: estTasks > 0 ? String(estTasks * 8) : draft.tracking.estimatedHours,
        },
      });
    } else {
      setMatrixDraft(matrixFromBlueprint(bp, defaults, defaultOwnerId));
    }
    setBulkCustomNames([]);
  }

  function selectEnterpriseTemplate(id: string) {
    const tpl = getEnterpriseTemplate(id);
    if (!tpl) return;
    setEnterpriseTemplateId(id);
    setBlueprintId("custom_program");
    const draft = structureDraftFromEnterpriseTemplate(tpl, {
      departmentId: structureDraft.departmentId || defaults.departmentId,
      teamId: structureDraft.teamId || defaults.teamId,
      ownerId: structureDraft.ownerId || defaultOwnerId,
    });
    const estTasks = countResolvedTasksForDraft(draft);
    setStructureDraft({
      ...draft,
      tracking: {
        ...draft.tracking,
        estimatedHours: estTasks > 0 ? String(estTasks * 8) : draft.tracking.estimatedHours,
      },
    });
    setBulkCustomNames([]);
  }

  function syncStructurePackages(names: string[]) {
    setStructureDraft((d) => {
      const existing = new Map(d.packages.map((p) => [p.name.toLowerCase(), p]));
      const phases =
        d.packages[0]?.phases.length > 0
          ? d.packages[0].phases
          : [{ label: String(new Date().getFullYear()) }];
      return {
        ...d,
        packages: names.map((name) => {
          const prev = existing.get(name.toLowerCase());
          return prev ?? { ...emptyPackageDraft(), name, phases, taskSetupMode: "manual" as const };
        }),
      };
    });
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (blueprint.kind === "structure") {
        if (!structureDraft.name.trim()) return "Program name is required.";
        if (!structureDraft.departmentId) return "Select a department.";
        if (!structureDraft.teamId) return "Select a team.";
        if (
          structureDraft.structureMode !== "simple_task_list" &&
          !structureDraft.packages.some((p) => p.name.trim())
        ) {
          return `Select at least one ${labels.workPackageShort.toLowerCase()}.`;
        }
      } else {
        if (!matrixDraft.name.trim()) return "Program name is required.";
        if (!matrixDraft.departmentId) return "Select a department.";
        if (!matrixDraft.teamId) return "Select a team.";
        if (!matrixDraft.selectedMakes.length) return "Select at least one make.";
        if (!matrixDraft.selectedYears.length) return "Select at least one year.";
      }
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      toast({ variant: "error", title: "Missing information", description: err });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    const err = validateStep();
    if (err) {
      toast({ variant: "error", title: "Cannot create program", description: err });
      return;
    }
    if (blueprint.kind === "matrix") {
      const taskCount = matrixPreview.counts.tasks;
      if (
        taskCount > 100 ||
        matrixPreview.capacityImpact === "critical" ||
        matrixPreview.capacityImpact === "high"
      ) {
        const ok = confirm(
          `Create ${taskCount.toLocaleString()} tasks? Capacity impact: ${matrixPreview.capacityImpact.replace(/_/g, " ")}.`
        );
        if (!ok) return;
      }
    }
    startTransition(async () => {
      try {
        if (blueprint.kind === "structure") {
          const trackingNotes = [
            structureDraft.tracking.qaRequired ? "QA required" : null,
            structureDraft.tracking.filesRequired ? "Files required" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          const project = await createProjectWithStructureAction({
            name: structureDraft.name.trim(),
            departmentId: structureDraft.departmentId,
            teamId: structureDraft.teamId,
            ownerId: structureDraft.ownerId,
            projectType: structureDraft.projectType,
            templateId: structureDraft.templateId,
            enterpriseTemplateId: structureDraft.enterpriseTemplateId || null,
            structureMode: structureDraft.structureMode,
            description: structureDraft.description || null,
            priority: structureDraft.priority,
            complexity: structureDraft.complexity,
            manualDueDate: structureDraft.manualDueDate || null,
            estimatedDocuments: Number(structureDraft.tracking.estimatedDocuments) || null,
            estimatedHours: Number(structureDraft.tracking.estimatedHours) || null,
            trackingNotes: trackingNotes || null,
            qaRequired: structureDraft.tracking.qaRequired,
            filesRequired: structureDraft.tracking.filesRequired,
            packages: structureDraft.packages.map((p) => ({
              name: p.name,
              phases: p.phases,
              tasks: p.tasks,
              taskSetupMode: p.taskSetupMode === "copy" ? "template" : p.taskSetupMode,
            })),
          });
          toast({
            variant: "success",
            title: "Program created",
            description: `${project.name} is ready at /projects/${project.id}`,
          });
          setOpen(false);
          reset();
          router.push(`/projects/${project.id}`);
          router.refresh();
        } else {
          const result = await createBulkMatrixProjectAction({
            name: matrixDraft.name.trim(),
            departmentId: matrixDraft.departmentId,
            teamId: matrixDraft.teamId,
            ownerId: matrixDraft.ownerId,
            projectType: matrixDraft.projectType,
            templateId: matrixDraft.templateId,
            description: matrixDraft.description || null,
            priority: matrixDraft.priority,
            complexity: matrixDraft.complexity,
            manualDueDate: matrixDraft.manualDueDate || null,
            matrixOrder: matrixDraft.matrixOrder,
            selectedMakes: matrixDraft.selectedMakes,
            selectedYears: matrixDraft.selectedYears,
            models: matrixDraft.models,
            useModelCount: matrixDraft.useModelCount,
            modelCountPerGroup: matrixDraft.modelCountPerGroup,
            docsPerTask: matrixDraft.docsPerTask,
            qaRequired: matrixDraft.qaRequired,
            filesRequired: matrixDraft.filesRequired,
            dailyTracking: matrixDraft.dailyTracking,
          });
          toast({
            variant: "success",
            title: "Program created",
            description: `${result.project.name} — ${result.taskCount} tasks generated`,
          });
          setOpen(false);
          reset();
          router.push(`/projects/${result.project.id}`);
          router.refresh();
        }
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not create program",
          description: e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    });
  }

  function renderStructureBasics() {
    const draft = structureDraft;
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Program name *</Label>
          <Input
            value={draft.name}
            onChange={(e) => setStructureDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Honda 2026 Validation"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <Label>Department *</Label>
            <Select
              value={draft.departmentId}
              onValueChange={(v) =>
                v &&
                setStructureDraft((d) => ({
                  ...d,
                  departmentId: v,
                  teamId: teamIdForDepartment(v, teams) ?? d.teamId,
                }))
              }
            >
              <SelectTrigger className={SELECT_TRIGGER}>
                <EntitySelectValue
                  value={draft.departmentId}
                  items={departments}
                  getLabel={(d) => d.name}
                  placeholder="Select department"
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Team *</Label>
            <Select
              value={draft.teamId}
              onValueChange={(v) => v && setStructureDraft((d) => ({ ...d, teamId: v }))}
            >
              <SelectTrigger className={SELECT_TRIGGER}>
                <EntitySelectValue
                  value={draft.teamId}
                  items={filteredTeams}
                  getLabel={(t) => t.name}
                  placeholder="Select team"
                />
              </SelectTrigger>
              <SelectContent>
                {filteredTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <Label>Owner</Label>
            <Select
              value={draft.ownerId}
              onValueChange={(v) => v && setStructureDraft((d) => ({ ...d, ownerId: v }))}
            >
              <SelectTrigger className={SELECT_TRIGGER}>
                <EntitySelectValue
                  value={draft.ownerId}
                  items={ownerCandidates}
                  getLabel={userDisplayName}
                  placeholder="Unassigned"
                  sentinels={[{ value: "__none__", label: "Unassigned" }]}
                />
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
          <div className="space-y-2 min-w-0">
            <Label>Target due date</Label>
            <Input
              type="date"
              value={draft.manualDueDate}
              onChange={(e) => setStructureDraft((d) => ({ ...d, manualDueDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={draft.description}
            onChange={(e) => setStructureDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional context for the team"
          />
        </div>
      </div>
    );
  }

  function renderMatrixBasics() {
    const draft = matrixDraft;
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Program name *</Label>
          <Input
            value={draft.name}
            onChange={(e) => setMatrixDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="SF Phase 1 2026"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <Label>Department *</Label>
            <Select
              value={draft.departmentId}
              onValueChange={(v) =>
                v &&
                setMatrixDraft((d) => ({
                  ...d,
                  departmentId: v,
                  teamId: teamIdForDepartment(v, teams) ?? d.teamId,
                }))
              }
            >
              <SelectTrigger className={SELECT_TRIGGER}>
                <EntitySelectValue
                  value={draft.departmentId}
                  items={departments}
                  getLabel={(d) => d.name}
                  placeholder="Select department"
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Team *</Label>
            <Select
              value={draft.teamId}
              onValueChange={(v) => v && setMatrixDraft((d) => ({ ...d, teamId: v }))}
            >
              <SelectTrigger className={SELECT_TRIGGER}>
                <EntitySelectValue
                  value={draft.teamId}
                  items={matrixFilteredTeams}
                  getLabel={(t) => t.name}
                  placeholder="Select team"
                />
              </SelectTrigger>
              <SelectContent>
                {matrixFilteredTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={draft.description}
            onChange={(e) => setMatrixDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional context for the team"
          />
        </div>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" className="h-8" />}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        New Program
      </DialogTrigger>
      <WizardDialogContent size="xl">
        <WizardDialogHeader>
          <DialogTitle>Create program</DialogTitle>
          <WizardStepper steps={[...STEPS]} current={step} compact />
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll className="pr-1">
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {PROGRAM_BLUEPRINTS.map((bp) => (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => selectBlueprint(bp.id)}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-colors",
                        blueprintId === bp.id && !enterpriseTemplateId
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/60 hover:bg-muted/20 hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Layers3 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{bp.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{bp.description}</p>
                          <ul className="mt-2 flex flex-wrap gap-1">
                            {bp.highlights.map((h) => (
                              <li
                                key={h}
                                className="text-[10px] rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground"
                              >
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {enterpriseTemplates.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div>
                      <p className="text-sm font-medium">Enterprise templates</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reusable workflows from{" "}
                        <span className="text-foreground">Operations → Templates</span>
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {enterpriseTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => selectEnterpriseTemplate(tpl.id)}
                          className={cn(
                            "rounded-lg border p-4 text-left transition-colors",
                            enterpriseTemplateId === tpl.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/60 hover:bg-muted/20 hover:border-primary/40"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <LayoutTemplate className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{tpl.label}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {tpl.description}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {tpl.category} · {tpl.tasks.length} tasks
                                {tpl.qaEnabled ? " · QA" : ""}
                                {tpl.fileUploadsRequired ? " · Files" : ""}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 1 && blueprint.kind === "structure" && (
              <div className="space-y-6">
                {renderStructureBasics()}
                <div className="space-y-2">
                  <Label>Project type</Label>
                  <Select
                    value={structureDraft.projectType}
                    onValueChange={(v) =>
                      v &&
                      setStructureDraft((d) => ({
                        ...d,
                        projectType: v,
                        templateId: d.templateId,
                      }))
                    }
                  >
                    <SelectTrigger className={SELECT_TRIGGER}>
                      <OptionSelectValue
                        value={structureDraft.projectType}
                        options={PROJECT_TYPES}
                        placeholder="Type"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work structure</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {WORK_STRUCTURE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setStructureDraft((d) => ({ ...d, structureMode: opt.value }))
                        }
                        className={cn(
                          "rounded-md border px-3 py-2.5 text-left text-sm",
                          structureDraft.structureMode === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:bg-muted/20"
                        )}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  <div className="space-y-2">
                    <Label>Est. documents (program)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={structureDraft.tracking.estimatedDocuments}
                      onChange={(e) =>
                        setStructureDraft((d) => ({
                          ...d,
                          tracking: { ...d.tracking, estimatedDocuments: e.target.value },
                        }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Est. hours (program)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={structureDraft.tracking.estimatedHours}
                      onChange={(e) =>
                        setStructureDraft((d) => ({
                          ...d,
                          tracking: { ...d.tracking, estimatedHours: e.target.value },
                        }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={structureDraft.tracking.qaRequired}
                      onCheckedChange={(v) =>
                        setStructureDraft((d) => ({
                          ...d,
                          tracking: { ...d.tracking, qaRequired: Boolean(v) },
                        }))
                      }
                    />
                    QA required
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={structureDraft.tracking.filesRequired}
                      onCheckedChange={(v) =>
                        setStructureDraft((d) => ({
                          ...d,
                          tracking: { ...d.tracking, filesRequired: Boolean(v) },
                        }))
                      }
                    />
                    Files required
                  </label>
                </div>
                {structureDraft.structureMode !== "simple_task_list" && (
                  <WorkPackageBulkPicker
                    labels={labels}
                    options={[...COMMON_WORK_PACKAGE_NAMES, ...(blueprint.presetPackages ?? [])]}
                    selected={selectedPackageNames}
                    customOptions={bulkCustomNames}
                    onSelectedChange={syncStructurePackages}
                    onAddCustom={(name) =>
                      setBulkCustomNames((prev) =>
                        prev.some((n) => n.toLowerCase() === name.toLowerCase())
                          ? prev
                          : [...prev, name]
                      )
                    }
                    onRemoveCustom={(name) =>
                      setBulkCustomNames((prev) =>
                        prev.filter((n) => n.toLowerCase() !== name.toLowerCase())
                      )
                    }
                  />
                )}
              </div>
            )}

            {step === 1 && blueprint.kind === "matrix" && (
              <div className="space-y-6">
                {renderMatrixBasics()}
                <div className="space-y-2">
                  <Label>Matrix order</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {BULK_MATRIX_ORDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMatrixDraft((d) => ({ ...d, matrixOrder: opt.value }))}
                        className={cn(
                          "rounded-md border px-3 py-2.5 text-left text-sm",
                          matrixDraft.matrixOrder === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:bg-muted/20"
                        )}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <YearDimensionPicker
                    suggestedYears={COMMON_MATRIX_YEARS}
                    selectedYears={matrixDraft.selectedYears}
                    customYears={customYears}
                    onSelectedChange={(years) =>
                      setMatrixDraft((d) => ({ ...d, selectedYears: sortNumbers(years) }))
                    }
                    onAddCustom={(y) =>
                      setCustomYears((prev) => (prev.includes(y) ? prev : [...prev, y]))
                    }
                    onRemoveCustom={(y) =>
                      setCustomYears((prev) => prev.filter((n) => n !== y))
                    }
                  />
                  <MatrixDimensionPicker
                    dimensionLabel="Make"
                    dimensionLabelPlural="Makes"
                    dimensionShort="Make"
                    suggested={COMMON_WORK_PACKAGE_NAMES}
                    selected={matrixDraft.selectedMakes}
                    customOptions={customMakes}
                    onSelectedChange={(names) =>
                      setMatrixDraft((d) => ({ ...d, selectedMakes: sortLabels(names) }))
                    }
                    onAddCustom={(name) =>
                      setCustomMakes((prev) =>
                        prev.some((n) => n.toLowerCase() === name.toLowerCase())
                          ? prev
                          : [...prev, name]
                      )
                    }
                    onRemoveCustom={(name) =>
                      setCustomMakes((prev) =>
                        prev.filter((n) => n.toLowerCase() !== name.toLowerCase())
                      )
                    }
                  />
                </div>
                <div className="rounded-md border border-border/50 p-4 space-y-3 max-w-md">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={matrixDraft.useModelCount}
                      onCheckedChange={(v) =>
                        setMatrixDraft((d) => ({ ...d, useModelCount: Boolean(v) }))
                      }
                    />
                    <Label className="font-normal">Use model count per make + year</Label>
                  </div>
                  {matrixDraft.useModelCount && (
                    <div className="space-y-2">
                      <Label className="text-xs">Models / tasks per group</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={matrixDraft.modelCountPerGroup}
                        onChange={(e) =>
                          setMatrixDraft((d) => ({
                            ...d,
                            modelCountPerGroup: Number(e.target.value) || 1,
                          }))
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs">Est. documents per task</Label>
                    <Input
                      type="number"
                      min={0}
                      value={matrixDraft.docsPerTask}
                      onChange={(e) =>
                        setMatrixDraft((d) => ({
                          ...d,
                          docsPerTask: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && blueprint.kind === "structure" && (
              <StructurePreviewPanel preview={structurePreview} />
            )}
            {step === 2 && blueprint.kind === "matrix" && (
              <BulkMatrixPreviewPanel
                preview={matrixPreview}
                matrixOrder={matrixDraft.matrixOrder}
              />
            )}
          </WizardDialogScroll>
          <WizardDialogFooter>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={back} disabled={pending}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={pending}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? "Creating…" : "Create program"}
              </Button>
            )}
          </WizardDialogFooter>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
