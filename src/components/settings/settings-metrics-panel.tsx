"use client";

import { ForecastSettingsAdmin } from "@/components/forecast/forecast-settings-admin";
import { NOMINAL_HOURS_PER_WORK_DAY } from "@/lib/forecast/capacity";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import type { ForecastSettings } from "@/types/flow";

export function SettingsMetricsPanel({
  settings,
  canEdit,
}: {
  settings: ForecastSettings;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-2">
        <p className="font-medium">How due dates are calculated</p>
        <p className="text-muted-foreground leading-relaxed">
          On each task, set <strong>Estimated files</strong> and Flow multiplies by{" "}
          <strong>minutes per file</strong>, applies complexity, then spreads work across your{" "}
          <strong>productive day capacity %</strong> on each working day to suggest a due date.
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          (files × minutes/file × complexity) ÷ ({NOMINAL_HOURS_PER_WORK_DAY}h × capacity% ÷ 100 ×
          60) = work days → due date
        </p>
      </div>

      {canEdit ? (
        <ForecastSettingsAdmin settings={settings} />
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2 max-w-lg">
          <div>
            <dt className="text-muted-foreground">Minutes per file</dt>
            <dd className="font-medium">{settings.minutes_per_document}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Productive day capacity</dt>
            <dd className="font-medium">{settings.productive_day_percent}%</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Working days</dt>
            <dd className="font-medium">
              {settings.working_days
                .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                .join(", ")}
            </dd>
          </div>
        </dl>
      )}

      <div>
        <p className="text-sm font-medium mb-2">Complexity multipliers</p>
        <p className="text-xs text-muted-foreground mb-3">
          Set per task when creating or editing — adjusts forecasted duration.
        </p>
        <div className="flex flex-wrap gap-2">
          {COMPLEXITY_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground"
            >
              {opt.label} <span className="text-foreground font-medium">{opt.multiplier}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
