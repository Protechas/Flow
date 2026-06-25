"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoardAction } from "@/app/actions/crud";
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
import { buildBoardPreview } from "@/lib/work-creation/preview";
import { BOARD_TEMPLATES, getBoardTemplate } from "@/lib/work-creation/templates";
import {
  buildCreationDefaults,
  resolveDepartmentLabel,
  teamIdForDepartment,
} from "@/lib/work-creation/client-defaults";
import type { BoardWizardState } from "@/lib/work-creation/types";
import { operationsHref } from "@/lib/navigation/deep-links";
import { userDisplayName } from "@/lib/users/display-name";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import type { Department, Team, User } from "@/types/flow";
import { ChevronDown, ChevronUp, Kanban } from "lucide-react";

const STEPS = ["Template", "Details", "Review"];

export function CreateBoardWizard({
  user: _user,
  departments,
  teams,
  analysts = [],
}: {
  user: User;
  departments: Department[];
  teams: Team[];
  analysts?: User[];
}) {
  const { toast } = useFlowToast();
  const router = useRouter();
  const defaults = buildCreationDefaults(_user, departments, teams);

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [board, setBoard] = useState<BoardWizardState>(() => {
    const tpl = getBoardTemplate("custom_board");
    return {
      templateId: "custom_board",
      name: "",
      departmentId: defaults.departmentId,
      description: "",
      qaRequired: tpl.defaultQaRequired ?? true,
      filesRequired: tpl.defaultFilesRequired ?? false,
      addFirstTask: false,
      firstTaskTitle: "",
      firstTaskAssignee: "__none__",
      firstTaskDueDate: "",
    };
  });

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
    setStep(0);
    setShowAdvanced(false);
    const tpl = getBoardTemplate("custom_board");
    setBoard({
      templateId: "custom_board",
      name: "",
      departmentId: defaults.departmentId,
      description: "",
      qaRequired: tpl.defaultQaRequired ?? true,
      filesRequired: tpl.defaultFilesRequired ?? false,
      addFirstTask: false,
      firstTaskTitle: "",
      firstTaskAssignee: "__none__",
      firstTaskDueDate: "",
    });
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

  function submit() {
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
          title: "Board created",
          description: `"${created.name}" is on Projects and Operations.`,
        });
        router.push(operationsHref({ grouping: "by_program", projectId: created.id }));
        router.refresh();
        setOpen(false);
        reset();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not create board",
          description: e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    });
  }

  const onReview = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="h-8">
            <Kanban className="h-3.5 w-3.5 mr-1.5" />
            New board
          </Button>
        }
      />
      <WizardDialogContent size="md">
        <WizardDialogHeader>
          <DialogTitle>New board</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Operations workspace for a department or team queue.
          </p>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll>
            <WizardStepper steps={STEPS} current={step} />

            {step === 0 && (
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

            {step === 1 && (
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
                    rows={3}
                    placeholder="What work will this board track?"
                  />
                </div>
                <div className="rounded-md border border-border/50 p-3 space-y-3">
                  <p className="text-xs font-medium">Default tracking for tasks on this board</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={board.qaRequired}
                      onCheckedChange={(v) => setBoard((b) => ({ ...b, qaRequired: Boolean(v) }))}
                    />
                    QA required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={board.filesRequired}
                      onCheckedChange={(v) => setBoard((b) => ({ ...b, filesRequired: Boolean(v) }))}
                    />
                    Files required
                  </label>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  onClick={() => setShowAdvanced((s) => !s)}
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  Optional first task
                </button>
                {showAdvanced && (
                  <div className="space-y-3 border rounded-md p-3 bg-muted/10">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={board.addFirstTask}
                        onCheckedChange={(v) => setBoard((b) => ({ ...b, addFirstTask: Boolean(v) }))}
                      />
                      Add first task now
                    </label>
                    {board.addFirstTask && (
                      <>
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
                        {analysts.length > 0 && (
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
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {onReview && <CreationPreviewPanel preview={preview} />}
          </WizardDialogScroll>

          <WizardDialogFooter className="gap-2 sm:gap-0">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={pending}
              >
                Back
              </Button>
            )}
            {!onReview ? (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={pending || (step === 1 && !board.name.trim())}
              >
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? "Creating…" : "Create board"}
              </Button>
            )}
          </WizardDialogFooter>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
