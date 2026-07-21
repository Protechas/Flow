"use client";

import { formatQueueDueFriendly, isQueueTaskOverdue } from "@/lib/employee/queue";
import { cn } from "@/lib/utils";
import type { WorkPackage } from "@/types/flow";
import { AlertTriangle, FolderKanban } from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  openTasks: number;
  overdueTasks: number;
  nextDueTask: WorkPackage | null;
}

/**
 * "My active projects" panel for teams whose operating model opts in
 * (workspace.showActiveProjectsPanel) — project-centric teams like Advanced
 * Projects live in projects, not a single task queue. Built entirely from the
 * employee's own assigned tasks; no extra data loading.
 */
export function EmployeeActiveProjects({ tasks }: { tasks: WorkPackage[] }) {
  const byProject = new Map<string, ProjectSummary>();
  for (const task of tasks) {
    if (task.status === "done") continue;
    const project = task.project;
    if (!project?.id) continue;
    const entry =
      byProject.get(project.id) ??
      ({
        id: project.id,
        name: project.name ?? "Untitled project",
        openTasks: 0,
        overdueTasks: 0,
        nextDueTask: null,
      } satisfies ProjectSummary);
    entry.openTasks += 1;
    if (isQueueTaskOverdue(task)) entry.overdueTasks += 1;
    const due = task.due_date ?? null;
    const currentDue = entry.nextDueTask?.due_date ?? null;
    if (due && (!currentDue || due < currentDue)) entry.nextDueTask = task;
    byProject.set(project.id, entry);
  }

  const projects = [...byProject.values()].sort(
    (a, b) => b.overdueTasks - a.overdueTasks || a.name.localeCompare(b.name)
  );
  if (projects.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
        My Active Projects
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {projects.map((p) => (
          <div
            key={p.id}
            className={cn(
              "enterprise-panel flex items-start gap-3 p-4",
              p.overdueTasks > 0 && "border-red-500/40 bg-red-500/5"
            )}
          >
            <FolderKanban
              className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                p.overdueTasks > 0 ? "text-red-500" : "text-primary"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug truncate">{p.name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {p.openTasks} open task{p.openTasks === 1 ? "" : "s"}
                {p.nextDueTask && <> · {formatQueueDueFriendly(p.nextDueTask)}</>}
              </p>
              {p.overdueTasks > 0 && (
                <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {p.overdueTasks} overdue
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
