"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoardAction } from "@/app/actions/crud";
import { CreateTaskComposer } from "@/components/work-creation/create-task-composer";
import { CreationPreviewPanel } from "@/components/work-creation/creation-preview-panel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { buildBoardPreview } from "@/lib/work-creation/preview";
import { BOARD_TEMPLATES, getBoardTemplate } from "@/lib/work-creation/templates";
import {
  buildCreationDefaults,
  resolveDepartmentLabel,
  teamIdForDepartment,
  workTargetProjects,
} from "@/lib/work-creation/client-defaults";
import type { BoardWizardState } from "@/lib/work-creation/types";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import { dismissNewWorkOnboarding } from "@/lib/work-creation/new-work-onboarding";
import { NewWorkOnboardingCallout } from "@/components/work-creation/new-work-onboarding-callout";
import { userDisplayName } from "@/lib/users/display-name";
import type {
  Department,
  ForecastSettings,
  Manufacturer,
  Project,
  Team,
  User,
  YearWorkItem,
} from "@/types/flow";
import type { OperatingContext } from "@/lib/operating-models/types";
import { Kanban, ListTodo, Plus } from "lucide-react";
import { operationsHref } from "@/lib/navigation/deep-links";
import { cn } from "@/lib/utils";

const BOARD_STEPS = ["Template", "Details & tracking", "Review"] as const;

function emptyBoardState(defaults: ReturnType<typeof buildCreationDefaults>): BoardWizardState {
  const tpl = getBoardTemplate("custom_board");
  return {
    templateId: "custom_board",
    name: "",
    departmentId: defaults.departmentId,
    description: "",
    qaRequired: tpl.defaultQaRequired ?? true,
    filesRequired: tpl.defaultFilesRequired ?? false,
    addFirstTask: true,
    firstTaskTitle: "",
    firstTaskAssignee: "__none__",
    firstTaskDueDate: "",
  };
}

export function ManagerWorkSetup({
  user,
  departments,
  teams,
  projects,
  manufacturers,
  yearItems,
  analysts,
  forecastSettings,
  defaultProjectId,
  creationScope,
  operatingContext,
}: {
  user: User;
  departments: Department[];
  teams: Team[];
  projects: Project[];
  manufacturers?: Manufacturer[];
  yearItems?: YearWorkItem[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  /** Pre-select project when creating a task (e.g. program detail page). */
  defaultProjectId?: string;
  /** Pre-fill department/team when creating from a team dashboard. */
  creationScope?: { departmentId?: string; teamId?: string };
  operatingContext?: OperatingContext;
}) {
  const { toast } = useFlowToast();
  const router = useRouter();
  const defaults = buildCreationDefaults(user, departments, teams, creationScope);
  const modes = getAllowedCreationModes(user.role);
  const canBoard = modes.includes("board");
  const canTask = modes.includes("task");

  const [hubOpen, setHubOpen] = useState(false);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "board">("pick");
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [board, setBoard] = useState<BoardWizardState>(() => emptyBoardState(defaults));

  const workTargets = useMemo(() => workTargetProjects(projects, user.role), [projects, user.role]);
  const anchorRef = useRef<HTMLDivElement>(null);
  const defaultTaskProjectId =
    defaultProjectId && workTargets.some((p) => p.id === defaultProjectId)
      ? defaultProjectId
      : workTargets[0]?.id;

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;

  const preview = useMemo(
    () =>
      buildBoardPreview({
        name: board.name,
        departmentName: deptName(board.departmentId),
        templateId: board.templateId,
        description: board.description,
        qaRequired: board.qaRequired,
        filesRequired: board.filesRequired,
        firstTaskTitle: board.addFirstTask ? board.firstTaskTitle : "",
      }),
    [board, departments]
  );

  function reset() {
    setMode("pick");
    setStep(0);
    setBoard(emptyBoardState(defaults));
  }

  function applyBoardTemplate(templateId: string) {
    const tpl = getBoardTemplate(templateId);
    setBoard((b) => ({
      ...b,
      templateId,
      description: tpl.purpose,
      qaRequired: tpl.defaultQaRequired ?? true,
      filesRequired: tpl.defaultFilesRequired ?? false,
      name: b.name || (tpl.id !== "custom_board" ? tpl.label : ""),
    }));
  }

  function openTaskComposer() {
    setHubOpen(false);
    reset();
    setTaskComposerOpen(true);
  }

  function submitBoard() {
    startTransition(async () => {
      try {
        const tpl = getBoardTemplate(board.templateId);
        const created = await createBoardAction({
          name: board.name,
          description: board.description,
          departmentId: board.departmentId,
          teamId: teamIdForDepartment(board.departmentId, teams),
          templateId: board.templateId,
          qaRequired: board.qaRequired,
          filesRequired: board.filesRequired,
          firstTask:
            board.addFirstTask && board.firstTaskTitle.trim()
              ? {
                  title: board.firstTaskTitle.trim(),
                  assignedTo:
                    board.firstTaskAssignee !== "__none__" ? board.firstTaskAssignee : null,
                  dueDate: board.firstTaskDueDate || null,
                  qaRequired: board.qaRequired,
                  filesRequired: board.filesRequired,
                  workstreamName: tpl.defaultWorkstream ?? "General",
                }
              : null,
        });
        toast({
          variant: "success",
          title: "Board ready",
          description: `"${created.name}" is on Operations with tracking enabled.`,
        });
        setHubOpen(false);
        reset();
        router.push(
          operationsHref({ grouping: "by_program", projectId: created.id })
        );
        router.refresh();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not create board",
          description: e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    });
  }

  if (!canBoard && !canTask) return null;

  const onReview = mode === "board" && step === BOARD_STEPS.length - 1;

  return (
    <>
      <Dialog
        open={hubOpen}
        onOpenChange={(v) => {
          setHubOpen(v);
          if (v) dismissNewWorkOnboarding(user.id);
          if (!v) reset();
        }}
      >
        <div ref={anchorRef} className="inline-flex">
          <DialogTrigger
            render={
              <Button size="sm" className="h-8" data-testid="new-work-hub-button">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New work
              </Button>
            }
          />
        </div>
        <NewWorkOnboardingCallout
          anchorRef={anchorRef}
          userId={user.id}
          onOpenHub={() => {
            dismissNewWorkOnboarding(user.id);
            setHubOpen(true);
          }}
        />
        <WizardDialogContent size={mode === "board" ? "lg" : "md"}>
          <WizardDialogHeader>
            <DialogTitle>
              {mode === "pick" ? "New work" : "New board"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {mode === "pick"
                ? "Build a team board or add a tracked task — built for managers and team leads."
                : "Operations workspace with QA and file tracking defaults."}
            </p>
          </WizardDialogHeader>
          <WizardDialogBody>
            <WizardDialogScroll>
              {mode === "pick" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {canBoard && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("board");
                        setStep(0);
                      }}
                      className="rounded-lg border border-border/60 p-4 text-left hover:border-primary/40 hover:bg-muted/20 transition-colors"
                    >
                      <Kanban className="h-5 w-5 text-primary mb-2" />
                      <p className="font-medium text-sm">New board</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Team queue on Operations — set QA/file tracking and optional first task.
                      </p>
                    </button>
                  )}
                  {canTask && (
                    <button
                      type="button"
                      onClick={openTaskComposer}
                      className="rounded-lg border border-border/60 p-4 text-left hover:border-primary/40 hover:bg-muted/20 transition-colors"
                    >
                      <ListTodo className="h-5 w-5 text-primary mb-2" />
                      <p className="font-medium text-sm">New task</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add one task to a board or program with assignee, due date, and tracking.
                      </p>
                    </button>
                  )}
                </div>
              )}

              {mode === "board" && (
                <>
                  <WizardStepper steps={[...BOARD_STEPS]} current={step} compact />

                  {step === 0 && (
                    <div className="space-y-2 mt-4">
                      <Label className="text-xs">Board template</Label>
                      <div className="grid gap-2">
                        {BOARD_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => applyBoardTemplate(tpl.id)}
                            className={cn(
                              "rounded-md border px-3 py-2 text-left text-sm",
                              board.templateId === tpl.id
                                ? "border-primary bg-primary/5"
                                : "border-border/60 hover:bg-muted/20"
                            )}
                          >
                            <span className="font-medium">{tpl.label}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Board name *</Label>
                        <Input
                          value={board.name}
                          onChange={(e) => setBoard((b) => ({ ...b, name: e.target.value }))}
                          placeholder="e.g. Team QA Queue"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select
                          value={board.departmentId || undefined}
                          onValueChange={(v) => v && setBoard((b) => ({ ...b, departmentId: v }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select department">
                              {resolveDepartmentLabel(board.departmentId, departments)}
                            </SelectValue>
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
                      <div className="space-y-2">
                        <Label>Purpose</Label>
                        <Textarea
                          value={board.description}
                          onChange={(e) => setBoard((b) => ({ ...b, description: e.target.value }))}
                          rows={2}
                        />
                      </div>

                      <div className="rounded-md border border-border/50 p-3 space-y-3">
                        <p className="text-xs font-medium">Default tracking for tasks on this board</p>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={board.qaRequired}
                            onCheckedChange={(v) =>
                              setBoard((b) => ({ ...b, qaRequired: Boolean(v) }))
                            }
                          />
                          QA required
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={board.filesRequired}
                            onCheckedChange={(v) =>
                              setBoard((b) => ({ ...b, filesRequired: Boolean(v) }))
                            }
                          />
                          Files required
                        </label>
                      </div>

                      <div className="rounded-md border border-border/50 p-3 space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={board.addFirstTask}
                            onCheckedChange={(v) =>
                              setBoard((b) => ({ ...b, addFirstTask: Boolean(v) }))
                            }
                          />
                          Add first task now
                        </label>
                        {board.addFirstTask && (
                          <div className="space-y-3 pl-1">
                            <div className="space-y-2">
                              <Label>Task name</Label>
                              <Input
                                value={board.firstTaskTitle}
                                onChange={(e) =>
                                  setBoard((b) => ({ ...b, firstTaskTitle: e.target.value }))
                                }
                                placeholder="First item on the board"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Assign to</Label>
                                <Select
                                  value={board.firstTaskAssignee}
                                  onValueChange={(v) =>
                                    v && setBoard((b) => ({ ...b, firstTaskAssignee: v }))
                                  }
                                >
                                  <SelectTrigger>
                                    <EntitySelectValue
                                      value={board.firstTaskAssignee}
                                      items={analysts}
                                      getLabel={userDisplayName}
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
                              <div className="space-y-2">
                                <Label>Due date</Label>
                                <Input
                                  type="date"
                                  value={board.firstTaskDueDate}
                                  onChange={(e) =>
                                    setBoard((b) => ({ ...b, firstTaskDueDate: e.target.value }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {onReview && <CreationPreviewPanel preview={preview} />}
                </>
              )}
            </WizardDialogScroll>

            {mode === "board" && (
              <WizardDialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (step === 0) {
                      setMode("pick");
                      setStep(0);
                    } else {
                      setStep((s) => s - 1);
                    }
                  }}
                  disabled={pending}
                >
                  Back
                </Button>
                {!onReview ? (
                  <Button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={pending || (step === 1 && !board.name.trim())}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button type="button" onClick={submitBoard} disabled={pending}>
                    {pending ? "Creating…" : "Create board"}
                  </Button>
                )}
              </WizardDialogFooter>
            )}
          </WizardDialogBody>
        </WizardDialogContent>
      </Dialog>

      {canTask && (
        <CreateTaskComposer
          user={user}
          projects={workTargets}
          manufacturers={manufacturers}
          yearItems={yearItems}
          analysts={analysts}
          forecastSettings={forecastSettings}
          defaultProjectId={defaultTaskProjectId}
          operatingContext={operatingContext}
          redirectToOperationsOnCreate
          open={taskComposerOpen}
          onOpenChange={setTaskComposerOpen}
          hideTrigger
        />
      )}
    </>
  );
}
