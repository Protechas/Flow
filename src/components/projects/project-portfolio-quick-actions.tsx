"use client";

import Link from "next/link";
import { CreateTaskComposer } from "@/components/work-creation/create-task-composer";
import { operationsHref, projectHealthHref } from "@/lib/navigation/deep-links";
import type {
  ForecastSettings,
  Manufacturer,
  Project,
  User,
  YearWorkItem,
} from "@/types/flow";
import { Activity, ArrowRight, HeartPulse, ListTodo } from "lucide-react";

export function ProjectPortfolioQuickActions({
  project,
  user,
  projects,
  manufacturers,
  yearItems,
  analysts,
  forecastSettings,
  canCreateTask = false,
  compact = false,
}: {
  project: Project;
  user?: User;
  projects: Project[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  canCreateTask?: boolean;
  compact?: boolean;
}) {
  const opsHref = operationsHref({ grouping: "by_program", projectId: project.id });
  const healthHref = projectHealthHref({ projectId: project.id });

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "flex-wrap"}`}>
      <Link
        href={opsHref}
        prefetch={false}
        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
      >
        <Activity className="h-3 w-3" />
        {compact ? "Ops" : "View in Operations"}
        <ArrowRight className="h-3 w-3" />
      </Link>
      <Link
        href={healthHref}
        prefetch={false}
        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
      >
        <HeartPulse className="h-3 w-3" />
        {compact ? "Health" : "Project health"}
      </Link>
      {canCreateTask && user && (
        <CreateTaskComposer
          user={user}
          projects={projects}
          manufacturers={manufacturers}
          yearItems={yearItems}
          analysts={analysts}
          forecastSettings={forecastSettings}
          defaultProjectId={project.id}
          redirectToOperationsOnCreate
          trigger={
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <ListTodo className="h-3 w-3" />
              Add task
            </button>
          }
        />
      )}
    </div>
  );
}
