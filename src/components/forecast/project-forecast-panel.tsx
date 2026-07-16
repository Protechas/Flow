import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import {
  formatForecastDays,
  formatForecastHours,
  measureProjectPace,
  remainingDocumentCount,
} from "@/lib/forecast/engine";
import type { Project, WorkPackage } from "@/types/flow";

export function ProjectForecastPanel({
  project,
  tasks = [],
}: {
  project: Project;
  tasks?: WorkPackage[];
}) {
  const hasForecast = project.estimated_total_documents != null && project.estimated_total_documents > 0;
  const hasActive = !!project.active_project_due_date;

  const pace = measureProjectPace(tasks);
  const docsRemaining = tasks.length > 0 ? remainingDocumentCount(tasks) : null;
  const measuredHours =
    pace && docsRemaining != null && docsRemaining > 0
      ? Math.round(((docsRemaining * pace.minutesPerDocument) / 60) * 10) / 10
      : null;
  // Person-days at the same daily capacity the planned estimate used
  const measuredDays =
    measuredHours != null &&
    project.estimated_total_hours &&
    project.estimated_total_hours > 0 &&
    project.estimated_total_work_days
      ? Math.round(
          measuredHours * (project.estimated_total_work_days / project.estimated_total_hours) * 10
        ) / 10
      : null;
  const plannedPace =
    hasForecast &&
    project.estimated_total_hours &&
    project.estimated_total_documents
      ? Math.round(((project.estimated_total_hours * 60) / project.estimated_total_documents) * 10) / 10
      : null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="enterprise-label mb-0">Project forecast</p>
        <DueDateStatusBadge status={project.project_due_date_status} />
      </div>

      {!hasForecast ? (
        <p className="text-sm text-muted-foreground">
          Add document estimates to active tasks to generate a project forecast.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Documents Remaining</p>
            <p className="font-semibold">{project.estimated_total_documents?.toLocaleString()}</p>
          </div>
          <div>
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wide"
              title="Time to finish the remaining documents at each task's planned pace. Does not include hours already logged."
            >
              Est. Hours Remaining
            </p>
            <p className="font-semibold">{formatForecastHours(project.estimated_total_hours)}</p>
          </div>
          <div>
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wide"
              title="One person working full productive days. Split across the team, calendar time is shorter."
            >
              Est. Person-Days
            </p>
            <p className="font-semibold">{formatForecastDays(project.estimated_total_work_days)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Planning Due Date</p>
            <p className="font-semibold">{project.planning_project_due_date ?? project.suggested_project_due_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {hasActive ? "Active Due Date" : "Primary Due Date"}
            </p>
            <p className="font-semibold">
              {hasActive
                ? project.active_project_due_date
                : project.suggested_project_due_date ?? "—"}
            </p>
          </div>
        </div>
      )}

      {hasForecast && measuredHours != null && pace && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <p>
            At the team&apos;s <strong>measured pace</strong> ({pace.minutesPerDocument} min/doc from{" "}
            {pace.docsSampled.toLocaleString()} completed documents), the remaining{" "}
            {docsRemaining?.toLocaleString()} documents ≈{" "}
            <strong>{formatForecastHours(measuredHours)}</strong>
            {measuredDays != null ? <> ({formatForecastDays(measuredDays)})</> : null}.
          </p>
          {plannedPace != null && pace.minutesPerDocument > plannedPace * 1.5 && (
            <p className="mt-1 text-xs text-muted-foreground">
              The planned estimate assumes {plannedPace} min/doc — the team is measuring well above
              that. Update the tasks&apos; minutes-per-document to make the planning dates realistic.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t border-border/50 pt-3">
        <span>
          Manual due date: <strong className="text-foreground">{project.manual_project_due_date ?? project.due_date ?? "—"}</strong>
        </span>
        <span title="How reliable the forecast is based on available estimates">
          Forecast Confidence: <strong className="text-foreground">{project.forecast_confidence ?? 0}%</strong>
        </span>
        <span>
          Estimates cover remaining work only — hours already logged are on the project header.
        </span>
      </div>
    </div>
  );
}
