"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  saveOperatingModelAction,
  suggestOperatingModelSlugAction,
} from "@/app/actions/operating-models";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PROJECT_TYPES } from "@/lib/constants";
import { formatActionError } from "@/lib/errors/action-messages";
import {
  EMPTY_OPERATING_MODEL_INPUT,
  type OperatingModelInput,
} from "@/lib/operating-models/form";
import {
  OPERATING_MODEL_KPI_CATALOG,
  TASK_TYPE_OPTIONS,
  TRACKING_FIELD_OPTIONS,
} from "@/lib/operating-models/kpi-catalog";
import { WORK_STRUCTURE_OPTIONS } from "@/lib/work-packages/smart-labels";
import type { Department, Team } from "@/types/flow";
import { ArrowLeft, Save } from "lucide-react";

const STEPS = [
  "Team / Department",
  "Work structure",
  "Project types",
  "Task types",
  "Tracking fields",
  "KPIs",
  "Forecasting",
  "Review",
] as const;

const EXTENDED_PROJECT_TYPES = [
  ...PROJECT_TYPES,
  { value: "id3_validation", label: "ID³ Validation" },
  { value: "training", label: "Training" },
];

export function OperatingModelBuilder({
  initial,
  teams,
  departments,
  mode,
}: {
  initial: OperatingModelInput;
  teams: Team[];
  departments: Department[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OperatingModelInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slugLocked = mode === "edit";

  const filteredTeams = useMemo(() => {
    if (!form.departmentId) return teams;
    return teams.filter((t) => t.department_id === form.departmentId);
  }, [teams, form.departmentId]);

  function update<K extends keyof OperatingModelInput>(key: K, value: OperatingModelInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function updateLabel(key: keyof OperatingModelInput["hierarchyLabels"], value: string) {
    setForm((prev) => ({
      ...prev,
      hierarchyLabels: { ...prev.hierarchyLabels, [key]: value },
    }));
    setError(null);
  }

  function toggleListItem(
    key: "projectTypes" | "taskTypes" | "trackingFields" | "kpiIds",
    value: string
  ) {
    setForm((prev) => {
      const list = prev[key] as string[];
      const has = list.includes(value);
      return {
        ...prev,
        [key]: has ? list.filter((v) => v !== value) : [...list, value],
      };
    });
    setError(null);
  }

  function handleSave() {
    startTransition(() => {
      void saveOperatingModelAction(form)
        .then(({ slug }) => {
          router.push(`/settings/operating-models/${slug}`);
          router.refresh();
        })
        .catch((e) => setError(formatActionError(e)));
    });
  }

  async function suggestSlug() {
    if (slugLocked || !form.label.trim()) return;
    const slug = await suggestOperatingModelSlugAction(form.label);
    update("slug", slug);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" render={<Link href="/settings/operating-models" />}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to models
      </Button>

      <WizardStepper steps={[...STEPS]} current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Team / Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Model name</Label>
              <Input
                value={form.label}
                onChange={(e) => update("label", e.target.value)}
                onBlur={() => void suggestSlug()}
                placeholder="Advanced Projects"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                disabled={slugLocked}
                onChange={(e) => update("slug", e.target.value)}
                placeholder="advanced-projects"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department (optional)</Label>
                <Select
                  value={form.departmentId ?? "__none__"}
                  onValueChange={(v) =>
                    update("departmentId", !v || v === "__none__" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Any department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team (optional)</Label>
                <Select
                  value={form.teamId ?? "__none__"}
                  onValueChange={(v) => update("teamId", !v || v === "__none__" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Any team</SelectItem>
                    {filteredTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Work structure labels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Structure mode</Label>
              <Select
                value={form.structureMode}
                onValueChange={(v) =>
                  update("structureMode", v as OperatingModelInput["structureMode"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STRUCTURE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Work package label</Label>
                <Input
                  value={form.hierarchyLabels.workPackage}
                  onChange={(e) => updateLabel("workPackage", e.target.value)}
                  placeholder="Manufacturer"
                />
              </div>
              <div className="space-y-2">
                <Label>Phase label</Label>
                <Input
                  value={form.hierarchyLabels.phase}
                  onChange={(e) => updateLabel("phase", e.target.value)}
                  placeholder="Year"
                />
              </div>
              <div className="space-y-2">
                <Label>Task label</Label>
                <Input
                  value={form.hierarchyLabels.task ?? "Task"}
                  onChange={(e) => updateLabel("task", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 3 — Default project types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {EXTENDED_PROJECT_TYPES.map((pt) => (
                <label
                  key={pt.value}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={form.projectTypes.includes(pt.value)}
                    onCheckedChange={() => toggleListItem("projectTypes", pt.value)}
                  />
                  {pt.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Default project type</Label>
              <Select
                value={form.defaultProjectType ?? "__none__"}
                onValueChange={(v) =>
                  update("defaultProjectType", !v || v === "__none__" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">First selected</SelectItem>
                  {form.projectTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EXTENDED_PROJECT_TYPES.find((p) => p.value === t)?.label ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 4 — Task types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPE_OPTIONS.map((tt) => (
                <label
                  key={tt}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={form.taskTypes.includes(tt)}
                    onCheckedChange={() => toggleListItem("taskTypes", tt)}
                  />
                  {tt.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 5 — Required tracking fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TRACKING_FIELD_OPTIONS.map((f) => (
                <label
                  key={f.value}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={form.trackingFields.includes(f.value)}
                    onCheckedChange={() => toggleListItem("trackingFields", f.value)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 6 — KPI configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
            {OPERATING_MODEL_KPI_CATALOG.map((kpi) => (
              <label
                key={kpi.id}
                className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2 cursor-pointer"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={form.kpiIds.includes(kpi.id)}
                  onCheckedChange={() => toggleListItem("kpiIds", kpi.id)}
                />
                <div>
                  <p className="text-sm font-medium">{kpi.name}</p>
                  <p className="text-xs text-muted-foreground">{kpi.description}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 7 — Forecasting rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Default minutes per unit</Label>
              <Input
                type="number"
                value={form.forecastDefaultMinutes ?? ""}
                onChange={(e) =>
                  update("forecastDefaultMinutes", Number(e.target.value) || undefined)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Productive hours / day</Label>
              <Input
                type="number"
                value={form.forecastProductiveHours ?? ""}
                onChange={(e) =>
                  update("forecastProductiveHours", Number(e.target.value) || undefined)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity threshold %</Label>
              <Input
                type="number"
                value={form.forecastCapacityThreshold ?? ""}
                onChange={(e) =>
                  update("forecastCapacityThreshold", Number(e.target.value) || undefined)
                }
              />
            </div>
            <div className="sm:col-span-3 flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.taskQaRequired}
                  onCheckedChange={(c) => update("taskQaRequired", Boolean(c))}
                />
                QA required by default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.taskFilesRequired}
                  onCheckedChange={(c) => update("taskFilesRequired", Boolean(c))}
                />
                Files required by default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.contentChecksEnabled !== false}
                  onCheckedChange={(c) => update("contentChecksEnabled", Boolean(c))}
                />
                Auto content checks on submissions (SI document standards)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.showWorkstreamPicker}
                  onCheckedChange={(c) => update("showWorkstreamPicker", Boolean(c))}
                />
                Show work package picker
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.showYearPicker}
                  onCheckedChange={(c) => update("showYearPicker", Boolean(c))}
                />
                Show phase/year picker
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 8 — Review & save</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Model:</span> {form.label || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Labels:</span>{" "}
              {form.hierarchyLabels.workPackage} / {form.hierarchyLabels.phase} /{" "}
              {form.hierarchyLabels.task ?? "Task"}
            </p>
            <p>
              <span className="text-muted-foreground">Project types:</span>{" "}
              {form.projectTypes.join(", ") || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">KPIs:</span> {form.kpiIds.length} selected
            </p>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button disabled={pending} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {pending ? "Saving…" : "Save operating model"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : null}
      </div>
    </div>
  );
}
