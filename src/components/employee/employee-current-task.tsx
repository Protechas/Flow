import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { LiveForecastStatusBadge } from "@/components/forecast/live-forecast-status-badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { buttonVariants } from "@/components/ui/button";
import { primaryDueDate } from "@/lib/forecast/live";
import type { WorkPackage } from "@/types/flow";
import { Play } from "lucide-react";

export function EmployeeCurrentTask({ task }: { task: WorkPackage }) {
  const isActive = task.forecast_mode === "active";
  const due = primaryDueDate(task);

  return (
    <div className="enterprise-panel border-primary/25 p-4 sm:p-5">
      <p className="enterprise-label mb-2">Active task</p>
      <h2 className="text-base sm:text-lg font-semibold leading-snug">{task.title}</h2>
      <p className="flow-meta mt-1">
        {task.project?.name} · {task.manufacturer?.name} · {task.year}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <LiveForecastStatusBadge status={task.live_forecast_status} />
        <DueDateStatusBadge status={task.due_date_status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {task.started_at && (
          <div>
            <dt className="text-[10px] text-muted-foreground uppercase">Started</dt>
            <dd className="font-medium">
              {new Date(task.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-[10px] text-muted-foreground uppercase">
            {isActive ? "Active forecast" : "Planning due"}
          </dt>
          <dd className="font-medium">{due ?? "—"}</dd>
        </div>
        {isActive && (
          <>
            <div>
              <dt className="text-[10px] text-muted-foreground uppercase">Completed</dt>
              <dd className="font-medium">{task.current_documents_completed ?? 0}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground uppercase">Remaining</dt>
              <dd className="font-medium">{task.estimated_remaining_documents ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] text-muted-foreground uppercase">Pace</dt>
              <dd className="font-medium">
                {task.current_production_rate != null
                  ? `${task.current_production_rate.toFixed(1)} min/doc`
                  : "—"}
              </dd>
            </div>
          </>
        )}
      </dl>
      <Link
        href={`/work/${task.id}`}
        className={cn(buttonVariants({ size: "lg" }), "w-full mt-4 h-10")}
      >
        <Play className="h-4 w-4 mr-2" />
        Continue working
      </Link>
    </div>
  );
}
