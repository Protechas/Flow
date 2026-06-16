"use client";

import { useMemo } from "react";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import {
  calculateProjectPlanningForecast,
  formatForecastDays,
  formatForecastHours,
} from "@/lib/forecast/engine";
import { useLiveForecastSettings } from "@/lib/forecast/use-live-forecast-settings";
import type { ForecastComplexityLevel, ForecastSettings } from "@/types/flow";

export function ProjectForecastSection({
  settings: initialSettings,
  documentCount,
  onDocumentCountChange,
  complexity,
  onComplexityChange,
  manualDueDate,
  onManualDueDateChange,
  startDate,
}: {
  settings: ForecastSettings;
  documentCount: string;
  onDocumentCountChange: (v: string) => void;
  complexity: ForecastComplexityLevel;
  onComplexityChange: (v: ForecastComplexityLevel) => void;
  manualDueDate: string;
  onManualDueDateChange: (v: string) => void;
  startDate?: string | null;
}) {
  const settings = useLiveForecastSettings(initialSettings);
  const docs = Number(documentCount) || 0;

  const forecast = useMemo(
    () =>
      calculateProjectPlanningForecast(
        {
          estimated_total_documents: docs > 0 ? docs : null,
          complexity_level: complexity,
          start_date: startDate ?? undefined,
          manual_project_due_date: manualDueDate || null,
          due_date: manualDueDate || null,
        },
        { settings }
      ),
    [docs, complexity, manualDueDate, startDate, settings]
  );

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="enterprise-label">Project due date forecasting</p>
      <p className="text-xs text-muted-foreground -mt-1">
        Enter total estimated document volume for this project. Task-level estimates will refine this forecast as work is added.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Est. total documents</Label>
          <Input
            type="number"
            min={0}
            step={1}
            name="estimated_total_documents"
            value={documentCount}
            onChange={(e) => onDocumentCountChange(e.target.value)}
            placeholder="e.g. 1800"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Complexity</Label>
          <Select
            value={complexity}
            onValueChange={(v) => onComplexityChange((v ?? "standard") as ForecastComplexityLevel)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPLEXITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} ({o.multiplier})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="planning_complexity_level" value={complexity} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="enterprise-panel px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Min / doc</p>
          <p className="font-medium">{settings.minutes_per_document}m</p>
        </div>
        <div className="enterprise-panel px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Est. hours</p>
          <p className="font-medium">{formatForecastHours(forecast.estimated_total_hours)}</p>
        </div>
        <div className="enterprise-panel px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Work days</p>
          <p className="font-medium">{formatForecastDays(forecast.estimated_total_work_days)}</p>
        </div>
        <div className="enterprise-panel px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Suggested due</p>
          <p className="font-medium">{forecast.suggested_project_due_date ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Manual project due date</Label>
          <Input
            type="date"
            name="due_date"
            value={manualDueDate}
            onChange={(e) => onManualDueDateChange(e.target.value)}
          />
          <input type="hidden" name="manual_project_due_date" value={manualDueDate} />
        </div>
        <div className="pt-5">
          <DueDateStatusBadge status={forecast.project_due_date_status} />
        </div>
      </div>
    </div>
  );
}
