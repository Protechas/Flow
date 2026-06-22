"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { previewTaskImpact } from "@/lib/planning/impact-preview";
import type { TaskImpactDraft } from "@/lib/planning/types";
import {
  capacityStatusLabel,
  outcomeLabel,
  riskLabel,
} from "@/lib/planning/utils";
import type {
  ForecastComplexityLevel,
  ForecastSettings,
  Project,
  User,
  WorkPackage,
} from "@/types/flow";

export function TaskImpactReview({
  title,
  documentCount,
  complexity,
  departmentId,
  projectId,
  assigneeId,
  viewer,
  users,
  packages,
  projects,
  teams,
  settings,
  departments = [],
}: {
  title: string;
  documentCount: number;
  complexity: ForecastComplexityLevel;
  departmentId?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  viewer: User;
  users: User[];
  packages: WorkPackage[];
  projects: Project[];
  teams: { id: string; department_id: string }[];
  settings: ForecastSettings;
  departments?: { id: string; name: string }[];
}) {
  const preview = useMemo(() => {
    if (documentCount <= 0) return null;
    const draft: TaskImpactDraft = {
      title,
      estimated_document_count: documentCount,
      complexity_level: complexity,
      department_id: departmentId,
      project_id: projectId,
      assigned_to: assigneeId,
    };
    return previewTaskImpact(draft, {
      viewer,
      users,
      packages,
      projects,
      teams,
      settings,
      departments,
    });
  }, [
    title,
    documentCount,
    complexity,
    departmentId,
    projectId,
    assigneeId,
    viewer,
    users,
    packages,
    projects,
    teams,
    settings,
    departments,
  ]);

  if (!preview) {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
        Enter estimated documents to preview task impact on capacity and forecasts.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-3 text-xs">
      <p className="font-semibold text-sm">Task Impact Review</p>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Est. hours" value={preview.taskForecast.estimatedHours.toFixed(1)} />
        <Metric label="Work days" value={preview.taskForecast.estimatedWorkDays.toFixed(1)} />
        <Metric label="Suggested due" value={preview.taskForecast.suggestedDueDate ?? "—"} />
        <Metric label="Confidence" value={`${preview.taskForecast.forecastConfidence}%`} />
      </div>

      <div className="space-y-1">
        <p className="text-muted-foreground">Department impact</p>
        <p>{preview.departmentDelay.explanation}</p>
      </div>

      {preview.projectDelay.applies && (
        <div className="space-y-1">
          <p className="text-muted-foreground">Project impact</p>
          <p>
            Current: {preview.projectDelay.currentForecastDate ?? "—"} → New:{" "}
            {preview.projectDelay.newForecastDate ?? "—"} (+{preview.projectDelay.daysAdded} days)
          </p>
          <p>Risk: {preview.projectDelay.riskChange}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-muted-foreground">Capacity:</span>
        <span>{preview.capacity.currentPct}% → {preview.capacity.afterPct}%</span>
        <Badge variant="outline">{capacityStatusLabel(preview.capacity.status)}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline">{riskLabel(preview.riskLevel)}</Badge>
        <Badge variant="outline">{outcomeLabel(preview.expectedOutcome)}</Badge>
      </div>

      {preview.recommendedAssignees.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <p className="font-medium">Recommended assignee</p>
          <p>
            {preview.recommendedAssignees[0].name}
            {preview.recommendedAssignees[0].remainingHours != null
              ? ` · ${preview.recommendedAssignees[0].remainingHours.toFixed(1)}h remaining`
              : ""}
          </p>
          <p className="text-muted-foreground">{preview.recommendedAssignees[0].reasoning}</p>
          {preview.recommendedAssignees.length > 1 && (
            <p className="text-muted-foreground">
              Alternatives:{" "}
              {preview.recommendedAssignees
                .slice(1, 3)
                .map((a) => a.name)
                .join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
