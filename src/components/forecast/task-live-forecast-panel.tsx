"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskDocumentProgressAction } from "@/app/actions/production";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { LiveForecastStatusBadge } from "@/components/forecast/live-forecast-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { primaryDueDate } from "@/lib/forecast/live";
import { forecastUnitLabels } from "@/lib/forecast/units";
import type { WorkPackage } from "@/types/flow";

export function TaskLiveForecastPanel({
  task,
  allowManualProgress,
}: {
  task: WorkPackage;
  allowManualProgress?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const unit = forecastUnitLabels(task.forecast_unit);
  const [docCount, setDocCount] = useState(String(task.current_documents_completed ?? 0));
  const isActive = task.forecast_mode === "active" && !!task.started_at;
  const primary = primaryDueDate(task);

  function saveDocProgress() {
    const count = Math.max(0, Number(docCount) || 0);
    startTransition(async () => {
      await updateTaskDocumentProgressAction(task.id, count);
      router.refresh();
    });
  }

  return (
    <div className="enterprise-panel p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="enterprise-label mb-0">Forecast</p>
        <div className="flex flex-wrap gap-1.5">
          <LiveForecastStatusBadge status={task.live_forecast_status} />
          <DueDateStatusBadge status={task.due_date_status} />
        </div>
      </div>

      {!task.estimated_document_count ? (
        <p className="text-sm text-muted-foreground">No {unit.singular} estimate on this task.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Est. {unit.plural}
            </p>
            <p className="font-semibold">{task.estimated_document_count}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Complexity</p>
            <p className="font-semibold capitalize">{task.complexity_level ?? "standard"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Min / {unit.singular}
            </p>
            <p className="font-semibold tabular-nums">
              {task.estimated_minutes_per_document != null
                ? `${task.estimated_minutes_per_document}m (task)`
                : "Org default"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Planning due</p>
            <p className="font-semibold">{task.planning_due_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {isActive ? "Active due" : "Primary due"}
            </p>
            <p className="font-semibold">{isActive ? task.active_due_date ?? "—" : primary ?? "—"}</p>
          </div>
          {(isActive || (task.current_documents_completed ?? 0) > 0) && (
            <>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Completed {unit.plural}
                </p>
                {allowManualProgress && isActive ? (
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={task.estimated_document_count ?? undefined}
                      className="h-8"
                      value={docCount}
                      onChange={(e) => setDocCount(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      disabled={pending}
                      onClick={saveDocProgress}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <p className="font-semibold">{task.current_documents_completed ?? 0}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining</p>
                <p className="font-semibold">{task.estimated_remaining_documents ?? "—"}</p>
              </div>
              {isActive && (
                <>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current pace</p>
                    <p className="font-semibold">
                      {task.current_production_rate != null
                        ? `${task.current_production_rate.toFixed(1)} min/${unit.singular}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Variance</p>
                    <p className="font-semibold">
                      {task.forecast_variance_days != null
                        ? `${task.forecast_variance_days > 0 ? "+" : ""}${task.forecast_variance_days} days`
                        : "—"}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {task.started_at && (
        <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
          Started {new Date(task.started_at).toLocaleString()}
          {task.forecast_last_updated && (
            <> · Updated {new Date(task.forecast_last_updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</>
          )}
        </p>
      )}
    </div>
  );
}
