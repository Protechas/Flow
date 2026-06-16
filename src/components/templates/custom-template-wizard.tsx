"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
import { WizardStepper } from "@/components/work-creation/wizard-stepper";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import { WORK_PRIORITIES } from "@/lib/constants";
import type { SaveCustomTemplateInput, EnterpriseTaskTemplate } from "@/lib/templates/enterprise-types";
import type { Department } from "@/types/flow";
import { Plus, Trash2 } from "lucide-react";

const STEPS = [
  "Template Info",
  "Project Structure",
  "Default Tasks",
  "Forecast Settings",
  "QA Settings",
  "Assignment Rules",
  "Review & Save",
];

function emptyTask(index: number): EnterpriseTaskTemplate {
  return {
    key: `task_${index}`,
    title: `Task ${index}`,
    status: "not_started",
    priority: "medium",
    sort_order: index,
    estimated_hours: 4,
    estimated_document_count: 10,
    complexity_level: "standard",
    requires_qa: true,
    requires_files: false,
  };
}

const DEFAULT_DRAFT: SaveCustomTemplateInput = {
  label: "",
  description: "",
  useCases: [""],
  category: "Custom",
  projectType: "custom",
  departmentIds: [],
  defaultPriority: "medium",
  defaultComplexity: "standard",
  defaultEstimatedDocuments: 50,
  forecastingEnabled: true,
  qaEnabled: true,
  fileUploadsRequired: true,
  wrapUpsEnabled: true,
  tasks: [
    emptyTask(1),
    emptyTask(2),
    emptyTask(3),
  ],
};

export function CustomTemplateWizard({
  departments,
  onCancel,
  onSaved,
  saveAction,
}: {
  departments: Department[];
  onCancel: () => void;
  onSaved: (templateId: string) => void;
  saveAction: (input: SaveCustomTemplateInput) => Promise<{ id: string }>;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SaveCustomTemplateInput>(DEFAULT_DRAFT);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onReview = step === STEPS.length - 1;

  function updateTask(index: number, patch: Partial<EnterpriseTaskTemplate>) {
    setDraft((d) => {
      const tasks = [...d.tasks];
      tasks[index] = { ...tasks[index], ...patch };
      return { ...d, tasks };
    });
  }

  function addTask() {
    setDraft((d) => ({
      ...d,
      tasks: [...d.tasks, emptyTask(d.tasks.length + 1)],
    }));
  }

  function removeTask(index: number) {
    setDraft((d) => ({
      ...d,
      tasks: d.tasks.filter((_, i) => i !== index).map((t, i) => ({ ...t, sort_order: i + 1 })),
    }));
  }

  function toggleDepartment(id: string) {
    setDraft((d) => ({
      ...d,
      departmentIds: d.departmentIds.includes(id)
        ? d.departmentIds.filter((x) => x !== id)
        : [...d.departmentIds, id],
    }));
  }

  function canContinue(): boolean {
    if (step === 0) return draft.label.trim().length > 0;
    if (step === 2) return draft.tasks.length > 0 && draft.tasks.every((t) => t.title.trim());
    return true;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await saveAction({
          ...draft,
          useCases: draft.useCases.filter(Boolean),
          tasks: draft.tasks.map((t, i) => ({
            ...t,
            sort_order: i + 1,
            key: t.key || `task_${i + 1}`,
          })),
        });
        onSaved(saved.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save template");
      }
    });
  }

  return (
    <div className="space-y-4">
      <WizardStepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Template name *</Label>
            <Input
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="e.g. Regional Audit Program"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Use cases</Label>
            {draft.useCases.map((uc, i) => (
              <Input
                key={i}
                value={uc}
                onChange={(e) => {
                  const useCases = [...draft.useCases];
                  useCases[i] = e.target.value;
                  setDraft((d) => ({ ...d, useCases }));
                }}
                placeholder={`Use case ${i + 1}`}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDraft((d) => ({ ...d, useCases: [...d.useCases, ""] }))}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add use case
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Category</Label>
            <Input
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Project type</Label>
            <Input
              value={draft.projectType}
              onChange={(e) => setDraft((d) => ({ ...d, projectType: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Department compatibility</Label>
            <p className="text-[11px] text-muted-foreground">
              Leave all unchecked for all departments.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {departments.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.departmentIds.includes(d.id)}
                    onChange={() => toggleDepartment(d.id)}
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Default priority</Label>
              <Select
                value={draft.defaultPriority}
                onValueChange={(v) =>
                  v && setDraft((d) => ({ ...d, defaultPriority: v as typeof d.defaultPriority }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
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
              <Label className="text-xs">Default complexity</Label>
              <Select
                value={draft.defaultComplexity}
                onValueChange={(v) =>
                  v &&
                  setDraft((d) => ({ ...d, defaultComplexity: v as typeof d.defaultComplexity }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
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
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {draft.tasks.map((task, i) => (
            <div key={i} className="flex gap-2 items-start border rounded-md p-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={task.title}
                  onChange={(e) => updateTask(i, { title: e.target.value })}
                  placeholder="Task title"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={task.estimated_hours ?? ""}
                    onChange={(e) =>
                      updateTask(i, { estimated_hours: Number(e.target.value) || 0 })
                    }
                    placeholder="Est. hours"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={task.requires_qa}
                      onChange={(e) => updateTask(i, { requires_qa: e.target.checked })}
                    />
                    QA required
                  </label>
                </div>
              </div>
              {draft.tasks.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => removeTask(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addTask}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add task
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.forecastingEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, forecastingEnabled: e.target.checked }))}
            />
            Enable forecasting for projects created from this template
          </label>
          <div className="space-y-2">
            <Label className="text-xs">Default estimated documents</Label>
            <Input
              type="number"
              min={0}
              value={draft.defaultEstimatedDocuments ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  defaultEstimatedDocuments: Number(e.target.value) || undefined,
                }))
              }
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.qaEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, qaEnabled: e.target.checked }))}
            />
            QA pipeline required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.fileUploadsRequired}
              onChange={(e) => setDraft((d) => ({ ...d, fileUploadsRequired: e.target.checked }))}
            />
            File uploads required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.wrapUpsEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, wrapUpsEnabled: e.target.checked }))}
            />
            Daily wrap-ups enabled
          </label>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3 text-sm text-muted-foreground border rounded-md p-4 bg-muted/10">
          <p className="font-medium text-foreground">Hierarchy-aware assignments</p>
          <p>
            Tasks are created unassigned. Managers and team leads assign work following hierarchy
            permissions — senior managers oversee managers, managers assign team leads and employees.
          </p>
          <p>
            Default project priority is <strong className="text-foreground">{draft.defaultPriority}</strong>.
            Owners set at project creation can be managers or team leads within the selected department.
          </p>
        </div>
      )}

      {onReview && (
        <div className="rounded-md border p-4 space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span> {draft.label}
          </p>
          <p>
            <span className="text-muted-foreground">Tasks:</span> {draft.tasks.length}
          </p>
          <p>
            <span className="text-muted-foreground">Forecasting:</span>{" "}
            {draft.forecastingEnabled ? "Yes" : "No"}
          </p>
          <p>
            <span className="text-muted-foreground">QA:</span> {draft.qaEnabled ? "Yes" : "No"}
          </p>
          {error && <p className="text-destructive">{error}</p>}
        </div>
      )}

      <div className="flex justify-between gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <div className="flex gap-2">
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
              disabled={!canContinue()}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={save} disabled={pending || !draft.label.trim()}>
              {pending ? "Saving…" : "Save template"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
