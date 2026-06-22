import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { formatForecastDays, formatForecastHours } from "@/lib/forecast/engine";
import type { Project } from "@/types/flow";

export function ProjectForecastPanel({ project }: { project: Project }) {
  const hasForecast = project.estimated_total_documents != null && project.estimated_total_documents > 0;
  const hasActive = !!project.active_project_due_date;

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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Documents</p>
            <p className="font-semibold">{project.estimated_total_documents?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estimated Hours</p>
            <p className="font-semibold">{formatForecastHours(project.estimated_total_hours)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estimated Work Days</p>
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

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t border-border/50 pt-3">
        <span>
          Manual due date: <strong className="text-foreground">{project.manual_project_due_date ?? project.due_date ?? "—"}</strong>
        </span>
        <span title="How reliable the forecast is based on available estimates">
          Forecast Confidence: <strong className="text-foreground">{project.forecast_confidence ?? 0}%</strong>
        </span>
      </div>
    </div>
  );
}
