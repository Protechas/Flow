"use client";

import { useEffect, useState, useTransition } from "react";
import { updateWorkPackageAction } from "@/app/actions/crud";
import { TaskForecastMetricsEditor, formatTaskMinutesPerFile } from "@/components/forecast/task-forecast-metrics-editor";
import { Button } from "@/components/ui/button";
import type { ForecastComplexityLevel, ForecastSettings, WorkPackage } from "@/types/flow";

export function TaskForecastMetricsSaveBlock({
  task,
  forecastSettings,
  canEdit,
  onSaved,
}: {
  task: WorkPackage;
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [estimatedFiles, setEstimatedFiles] = useState(
    task.estimated_document_count != null ? String(task.estimated_document_count) : ""
  );
  const [complexity, setComplexity] = useState<ForecastComplexityLevel>(
    task.complexity_level ?? "standard"
  );
  const [minutesPerFile, setMinutesPerFile] = useState(
    formatTaskMinutesPerFile(task.estimated_minutes_per_document)
  );

  useEffect(() => {
    setEstimatedFiles(
      task.estimated_document_count != null ? String(task.estimated_document_count) : ""
    );
    setComplexity(task.complexity_level ?? "standard");
    setMinutesPerFile(formatTaskMinutesPerFile(task.estimated_minutes_per_document));
  }, [task]);

  function save() {
    if (!canEdit) return;
    startTransition(async () => {
      const docCount = estimatedFiles.trim() === "" ? null : Number(estimatedFiles);
      const minutes =
        minutesPerFile.trim() === "" ? null : Number.isNaN(Number(minutesPerFile))
          ? null
          : Number(minutesPerFile);
      await updateWorkPackageAction(task.id, {
        estimated_document_count: docCount,
        complexity_level: complexity,
        estimated_minutes_per_document: minutes,
      });
      onSaved?.();
    });
  }

  return (
    <div className="space-y-2">
      <TaskForecastMetricsEditor
        forecastSettings={forecastSettings}
        canEdit={canEdit}
        estimatedFiles={estimatedFiles}
        onEstimatedFilesChange={setEstimatedFiles}
        complexity={complexity}
        onComplexityChange={setComplexity}
        minutesPerFile={minutesPerFile}
        onMinutesPerFileChange={setMinutesPerFile}
        manualDueDate={task.manual_due_date ?? task.due_date ?? undefined}
        startDate={task.start_date ?? task.forecast_start_date}
      />
      {canEdit && (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save forecast settings"}
        </Button>
      )}
    </div>
  );
}
