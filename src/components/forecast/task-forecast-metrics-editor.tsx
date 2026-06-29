"use client";

import { useMemo } from "react";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import {
  calculateTaskForecast,
  formatForecastDays,
  formatForecastHours,
} from "@/lib/forecast/engine";
import { useLiveForecastSettings } from "@/lib/forecast/use-live-forecast-settings";
import type { ForecastComplexityLevel, ForecastSettings } from "@/types/flow";

export function TaskForecastMetricsEditor({
  forecastSettings: initialSettings,
  canEdit,
  estimatedFiles,
  onEstimatedFilesChange,
  complexity,
  onComplexityChange,
  minutesPerFile,
  onMinutesPerFileChange,
  manualDueDate,
  startDate,
}: {
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  estimatedFiles: string;
  onEstimatedFilesChange: (value: string) => void;
  complexity: ForecastComplexityLevel;
  onComplexityChange: (value: ForecastComplexityLevel) => void;
  /** Empty string = use org default minutes per file. */
  minutesPerFile: string;
  onMinutesPerFileChange: (value: string) => void;
  manualDueDate?: string;
  startDate?: string | null;
}) {
  const settings = useLiveForecastSettings(initialSettings);
  const docs = estimatedFiles.trim() === "" ? 0 : Number(estimatedFiles);
  const minutesOverride =
    minutesPerFile.trim() === "" ? null : Number.isNaN(Number(minutesPerFile))
      ? null
      : Number(minutesPerFile);

  const forecast = useMemo(
    () =>
      calculateTaskForecast(
        {
          estimated_document_count: docs > 0 ? docs : null,
          complexity_level: complexity,
          estimated_minutes_per_document: minutesOverride,
          start_date: startDate ?? undefined,
          manual_due_date: manualDueDate || null,
          due_date: manualDueDate || null,
        },
        { settings }
      ),
    [docs, complexity, minutesOverride, manualDueDate, startDate, settings]
  );

  const effectiveMinutes = minutesOverride ?? settings.minutes_per_document;
  const usingOrgMinutes = minutesOverride == null;

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium">Forecast for this task</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          Org default: {settings.minutes_per_document} min/file · {settings.productive_day_percent}%
          day capacity
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Est. files</Label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 120"
            value={estimatedFiles}
            disabled={!canEdit}
            onChange={(e) => onEstimatedFilesChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Complexity</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={complexity}
            disabled={!canEdit}
            onChange={(e) => onComplexityChange(e.target.value as ForecastComplexityLevel)}
          >
            {COMPLEXITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.multiplier})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Minutes per file</Label>
          <Input
            type="number"
            min={0.5}
            step={0.5}
            placeholder={`Org default (${settings.minutes_per_document})`}
            value={minutesPerFile}
            disabled={!canEdit}
            onChange={(e) => onMinutesPerFileChange(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            {usingOrgMinutes
              ? "Leave blank to use Settings default."
              : `Using ${effectiveMinutes} min/file for this task only.`}
          </p>
        </div>
      </div>

      {docs > 0 ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border bg-background/60 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Min / file</p>
            <p className="font-medium tabular-nums">{effectiveMinutes}m</p>
          </div>
          <div className="rounded-md border bg-background/60 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Est. hours</p>
            <p className="font-medium tabular-nums">
              {formatForecastHours(forecast.estimated_work_hours)}
            </p>
          </div>
          <div className="rounded-md border bg-background/60 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Work days</p>
            <p className="font-medium tabular-nums">
              {formatForecastDays(forecast.estimated_work_days)}
            </p>
          </div>
          <div className="rounded-md border bg-background/60 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Planning due</p>
            <p className="font-medium tabular-nums">{forecast.suggested_due_date ?? "—"}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Add estimated files to preview a due date.</p>
      )}

      {docs > 0 && (
        <div className="flex items-center justify-end">
          <DueDateStatusBadge status={forecast.due_date_status} />
        </div>
      )}
    </div>
  );
}

/** Format stored minutes override for controlled input. */
export function formatTaskMinutesPerFile(value: number | null | undefined): string {
  return value != null && !Number.isNaN(value) ? String(value) : "";
}
