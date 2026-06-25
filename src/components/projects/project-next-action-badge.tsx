"use client";

import Link from "next/link";
import { CreateTaskComposer } from "@/components/work-creation/create-task-composer";
import type { NextAction } from "@/lib/projects/portfolio-utils";
import { cn } from "@/lib/utils";
import type {
  ForecastSettings,
  Manufacturer,
  Project,
  User,
  YearWorkItem,
} from "@/types/flow";

export function nextActionChipClass(tone: NextAction["tone"]) {
  switch (tone) {
    case "danger":
      return "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/15";
    case "warn":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15";
    case "success":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15";
    case "muted":
      return "text-muted-foreground border-border/50 bg-muted/20";
    default:
      return "text-muted-foreground border-border/50 bg-muted/20 hover:bg-muted/30";
  }
}

export function ProjectNextActionBadge({
  action,
  project,
  projects,
  manufacturers = [],
  yearItems = [],
  analysts = [],
  forecastSettings,
  user,
  prefix = "Next: ",
  className,
}: {
  action: NextAction;
  project: Project;
  projects?: Project[];
  manufacturers?: Manufacturer[];
  yearItems?: YearWorkItem[];
  analysts?: User[];
  forecastSettings?: ForecastSettings;
  user?: User;
  prefix?: string;
  className?: string;
}) {
  const chipClass = cn(
    "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium transition-colors",
    nextActionChipClass(action.tone),
    (action.href || action.openTaskComposer) && "cursor-pointer",
    className
  );

  if (action.openTaskComposer && user && forecastSettings) {
    return (
      <CreateTaskComposer
        user={user}
        projects={projects ?? [project]}
        manufacturers={manufacturers}
        yearItems={yearItems}
        analysts={analysts}
        forecastSettings={forecastSettings}
        defaultProjectId={project.id}
        redirectToOperationsOnCreate
        trigger={
          <button type="button" className={chipClass}>
            {prefix}
            {action.label}
          </button>
        }
      />
    );
  }

  if (action.href) {
    return (
      <Link href={action.href} className={chipClass}>
        {prefix}
        {action.label}
      </Link>
    );
  }

  return (
    <span className={chipClass}>
      {prefix}
      {action.label}
    </span>
  );
}
