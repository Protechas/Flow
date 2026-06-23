"use client";

import { useEffect, useState, useTransition } from "react";
import {
  archiveProjectMetricAction,
  createProjectMetricAction,
  listProjectMetricDefinitionsAction,
  reorderProjectMetricsAction,
} from "@/app/actions/project-metrics";
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatActionError } from "@/lib/errors/action-messages";
import type {
  Project,
  ProjectMetricDefinition,
  ProjectMetricDisplayStyle,
  ProjectMetricFormulaDefinition,
  ProjectMetricType,
} from "@/types/flow";
import { Archive, Plus, Save } from "lucide-react";

const METRIC_TYPES: { value: ProjectMetricType; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "percentage", label: "Percentage" },
  { value: "currency", label: "Currency" },
  { value: "hours", label: "Hours" },
  { value: "boolean", label: "Boolean" },
  { value: "status", label: "Status" },
  { value: "calculated", label: "Calculated" },
];

const DISPLAY_STYLES: { value: ProjectMetricDisplayStyle; label: string }[] = [
  { value: "metric_card", label: "Metric card" },
  { value: "progress_bar", label: "Progress bar" },
  { value: "percentage_ring", label: "Percentage ring" },
  { value: "status_badge", label: "Status badge" },
  { value: "target_vs_actual", label: "Target vs actual" },
  { value: "kpi_tile", label: "KPI tile" },
];

const FORMULA_KINDS: { value: ProjectMetricFormulaDefinition["kind"]; label: string }[] = [
  { value: "qa_pass_rate", label: "QA pass rate" },
  { value: "completion_pct", label: "Completion %" },
  { value: "forecast_confidence", label: "Forecast confidence" },
  { value: "correction_count", label: "Corrections count" },
  { value: "hours_variance", label: "Hours variance" },
  { value: "documents_processed", label: "Documents processed" },
  { value: "files_uploaded", label: "Files uploaded" },
  { value: "ready_for_qa", label: "Ready for QA" },
];

export function ProjectMetricsManager({
  project,
  open,
  onOpenChange,
  onUpdated,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const [definitions, setDefinitions] = useState<ProjectMetricDefinition[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metricType, setMetricType] = useState<ProjectMetricType>("number");
  const [displayStyle, setDisplayStyle] = useState<ProjectMetricDisplayStyle>("metric_card");
  const [target, setTarget] = useState("");
  const [isFormula, setIsFormula] = useState(false);
  const [formulaKind, setFormulaKind] = useState<ProjectMetricFormulaDefinition["kind"]>("qa_pass_rate");

  function load() {
    startTransition(async () => {
      try {
        const data = await listProjectMetricDefinitionsAction(project.id);
        setDefinitions(data);
        setError(null);
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  useEffect(() => {
    if (open) load();
  }, [open, project.id]);

  function resetForm() {
    setName("");
    setDescription("");
    setMetricType("number");
    setDisplayStyle("metric_card");
    setTarget("");
    setIsFormula(false);
    setFormulaKind("qa_pass_rate");
    setAdding(false);
  }

  function createMetric() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createProjectMetricAction(project.id, {
          metric_name: name.trim(),
          metric_description: description.trim() || null,
          metric_type: isFormula ? "calculated" : metricType,
          target_value: target ? Number(target) : null,
          display_style: displayStyle,
          is_formula: isFormula,
          formula_definition: isFormula ? { kind: formulaKind } : null,
        });
        resetForm();
        load();
        onUpdated?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  function archiveMetric(id: string) {
    startTransition(async () => {
      try {
        await archiveProjectMetricAction(id);
        load();
        onUpdated?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  function moveMetric(id: string, direction: -1 | 1) {
    const idx = definitions.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= definitions.length) return;
    const ordered = [...definitions];
    const [item] = ordered.splice(idx, 1);
    ordered.splice(next, 0, item);
    startTransition(async () => {
      try {
        await reorderProjectMetricsAction(
          project.id,
          ordered.map((d) => d.id)
        );
        load();
        onUpdated?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage metrics — {project.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <ul className="space-y-2">
            {definitions.map((def, index) => (
              <li
                key={def.id}
                className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{def.metric_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {def.metric_type}
                      {def.is_formula ? " · calculated" : ""}
                      {def.target_value != null ? ` · target ${def.target_value}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1 text-xs"
                      disabled={index === 0 || pending}
                      onClick={() => moveMetric(def.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1 text-xs"
                      disabled={index === definitions.length - 1 || pending}
                      onClick={() => moveMetric(def.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1"
                      onClick={() => archiveMetric(def.id)}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {adding ? (
            <div className="space-y-3 rounded-lg border border-border/50 p-4">
              <div className="space-y-1.5">
                <Label>Metric name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isFormula}
                  onChange={(e) => setIsFormula(e.target.checked)}
                />
                Calculated from project data
              </label>
              {isFormula ? (
                <Select
                  value={formulaKind}
                  onValueChange={(v) => v && setFormulaKind(v as ProjectMetricFormulaDefinition["kind"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMULA_KINDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={metricType}
                  onValueChange={(v) => v && setMetricType(v as ProjectMetricType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_TYPES.filter((t) => t.value !== "calculated").map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select
                value={displayStyle}
                onValueChange={(v) => v && setDisplayStyle(v as ProjectMetricDisplayStyle)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Display style" />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1.5">
                <Label>Target value (optional)</Label>
                <Input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={createMetric} disabled={pending}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Add metric
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add metric
            </Button>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
