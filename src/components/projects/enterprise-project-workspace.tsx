"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUpAZ, Plus, Settings2, Trash2 } from "lucide-react";
import { deleteProjectAction, deleteWorkPackageAction, updateWorkPackageAction } from "@/app/actions/crud";
import {
  addWorkspaceSectionAction,
  createWorkspaceTaskAction,
  updateProjectWorkspaceColumnsAction,
} from "@/app/actions/project-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  getProjectWorkspaceConfig,
  parseCustomFields,
  taskProgress,
} from "@/lib/projects/workspace-config";
import { buildWorkspaceKpis } from "@/lib/projects/workspace-kpis";
import { primaryDueDate } from "@/lib/forecast/live";
import { COMPLEXITY_OPTIONS } from "@/lib/forecast/constants";
import type { ProjectWorkspaceConfig, WorkspaceColumnDef } from "@/lib/projects/workspace-types";
import type {
  ActivityEvent,
  Department,
  ForecastSettings,
  Manufacturer,
  Project,
  QaReview,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { WorkspaceColumnSettings } from "@/components/projects/workspace-column-settings";
import { WorkspaceTaskDetailSheet } from "@/components/projects/workspace-task-detail-sheet";
import { ProjectForecastPanel } from "@/components/forecast/project-forecast-panel";
import { ProjectValidationPanel } from "@/components/validation-center/project-validation-panel";
import type { ProjectValidationMetrics } from "@/lib/validation-center/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  "not_started",
  "assigned",
  "working_on_it",
  "waiting",
  "ready_for_qa",
  "in_qa",
  "correction_needed",
  "stuck",
  "done",
] as const;

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

type TaskSort = "default" | "title-asc" | "title-desc";

function sortTasks(tasks: WorkPackage[], sort: TaskSort): WorkPackage[] {
  const sorted = [...tasks];
  // Default = build order. Guaranteed here, not just by fetch order, so an
  // edit can never float a task to the top of the board.
  const cmp =
    sort === "default"
      ? (a: WorkPackage, b: WorkPackage) => a.created_at.localeCompare(b.created_at)
      : sort === "title-asc"
        ? (a: WorkPackage, b: WorkPackage) =>
            a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
        : (a: WorkPackage, b: WorkPackage) =>
            b.title.localeCompare(a.title, undefined, { sensitivity: "base", numeric: true });
  return sorted.sort(cmp);
}

function nextTitleSort(current: TaskSort): TaskSort {
  if (current === "default") return "title-asc";
  if (current === "title-asc") return "title-desc";
  return "default";
}

export function EnterpriseProjectWorkspace({
  project,
  manufacturers,
  yearItems,
  workPackages,
  analysts,
  managers,
  departments,
  qaReviews,
  activity,
  canEdit,
  canDeleteProject,
  canDeleteTask,
  forecastSettings,
  validationMetrics,
  canViewValidation,
}: {
  project: Project;
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  workPackages: WorkPackage[];
  analysts: User[];
  managers: User[];
  departments: Department[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  canEdit: boolean;
  canDeleteProject: boolean;
  canDeleteTask: boolean;
  forecastSettings: ForecastSettings;
  validationMetrics?: ProjectValidationMetrics | null;
  canViewValidation?: boolean;
}) {
  const router = useRouter();
  const sections = useMemo(
    () => manufacturers.filter((m) => m.project_id === project.id),
    [manufacturers, project.id]
  );
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [config, setConfig] = useState<ProjectWorkspaceConfig>(() =>
    getProjectWorkspaceConfig(project, sections)
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [view, setView] = useState<"tasks" | "forecast" | "qa" | "activity">("tasks");
  const [pending, startTransition] = useTransition();
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [taskSort, setTaskSort] = useState<TaskSort>("title-asc");

  const sectionTasks = useMemo(
    () => workPackages.filter((t) => t.manufacturer_id === activeSectionId),
    [workPackages, activeSectionId]
  );

  const sortedSectionTasks = useMemo(
    () => sortTasks(sectionTasks, taskSort),
    [sectionTasks, taskSort]
  );

  const allProjectTasks = useMemo(
    () => workPackages.filter((t) => t.project_id === project.id),
    [workPackages, project.id]
  );

  const kpis = useMemo(
    () => buildWorkspaceKpis(allProjectTasks, config.tracking),
    [allProjectTasks, config.tracking]
  );

  const owner = managers.find((m) => m.id === project.project_owner_id);
  const dept = departments.find((d) => d.id === project.department_id);
  const assignablePeople = useMemo(() => {
    const byId = new Map<string, User>();
    for (const p of [...managers, ...analysts]) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return [...byId.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
    );
  }, [managers, analysts]);
  const visibleColumns = config.columns.filter((c) => c.visible);
  const selectedTask = workPackages.find((t) => t.id === selectedTaskId) ?? null;

  const projectTaskIds = useMemo(
    () => new Set(allProjectTasks.map((t) => t.id)),
    [allProjectTasks]
  );

  const projectActivity = useMemo(
    () => activity.filter((e) => e.work_package_id && projectTaskIds.has(e.work_package_id)).slice(0, 20),
    [activity, projectTaskIds]
  );

  const qaQueue = useMemo(
    () =>
      allProjectTasks.filter((t) => t.status === "ready_for_qa" || t.status === "in_qa").length,
    [allProjectTasks]
  );

  function refreshColumns(next: WorkspaceColumnDef[]) {
    setConfig((prev) => ({ ...prev, columns: next }));
    startTransition(async () => {
      await updateProjectWorkspaceColumnsAction(project.id, next);
    });
  }

  function addSection() {
    const name = newSectionName.trim();
    if (!name) return;
    startTransition(async () => {
      await addWorkspaceSectionAction(project.id, name);
      setNewSectionName("");
    });
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title || !activeSectionId) return;
    startTransition(async () => {
      await createWorkspaceTaskAction({
        projectId: project.id,
        sectionId: activeSectionId,
        title,
        qaRequired: config.tracking.qaRequired,
        filesRequired: config.tracking.fileUploads,
      });
      setNewTaskTitle("");
    });
  }

  function deleteProject() {
    if (
      !confirm(
        `Delete "${project.name}" and all sections, tasks, and related data? This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteProjectAction(project.id);
      router.push("/projects");
      router.refresh();
    });
  }

  function deleteTask(task: WorkPackage) {
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteWorkPackageAction(task.id);
      if (selectedTaskId === task.id) setSelectedTaskId(null);
      router.refresh();
    });
  }

  function updateTaskField(taskId: string, field: string, value: string) {
    startTransition(async () => {
      const patch: Record<string, unknown> = {};
      if (field === "title") patch.title = value;
      if (field === "status") patch.status = value;
      if (field === "priority") patch.priority = value;
      if (field === "due_date") patch.due_date = value || null;
      if (field === "assigned_to") patch.assigned_to = value || null;
      if (field === "estimated_hours") patch.estimated_hours = Number(value) || 0;
      if (field === "estimated_document_count") {
        patch.estimated_document_count =
          value === "" ? null : Number.isNaN(Number(value)) ? null : Number(value);
      }
      if (field === "complexity_level") patch.complexity_level = value;
      if (field === "notes") patch.notes = value;
      await updateWorkPackageAction(taskId, patch);
    });
  }

  function renderCell(task: WorkPackage, col: WorkspaceColumnDef) {
    const custom = parseCustomFields(task.description);
    if (col.builtIn === "title") return <span className="font-medium">{task.title}</span>;
    if (col.builtIn === "assigned_to") {
      return (
        <select
          className="h-8 min-w-[120px] max-w-[160px] rounded-md border bg-background px-2 text-xs truncate"
          value={task.assigned_to ?? ""}
          disabled={!canEdit}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateTaskField(task.id, "assigned_to", e.target.value)}
        >
          <option value="">Unassigned</option>
          {assignablePeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      );
    }
    if (col.builtIn === "status") {
      return (
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs capitalize"
          value={task.status}
          disabled={!canEdit}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateTaskField(task.id, "status", e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      );
    }
    if (col.builtIn === "priority") return <span className="capitalize">{task.priority}</span>;
    if (col.builtIn === "due_date") return primaryDueDate(task) ?? "—";
    if (col.builtIn === "estimated_hours") return task.estimated_hours ?? 0;
    if (col.builtIn === "estimated_document_count") {
      return (
        <Input
          type="number"
          min={0}
          className="h-8 w-20 text-xs"
          value={task.estimated_document_count ?? ""}
          disabled={!canEdit}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            updateTaskField(
              task.id,
              "estimated_document_count",
              e.target.value
            )
          }
        />
      );
    }
    if (col.builtIn === "complexity_level") {
      return (
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs capitalize"
          value={task.complexity_level ?? "standard"}
          disabled={!canEdit}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateTaskField(task.id, "complexity_level", e.target.value)}
        >
          {COMPLEXITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (col.builtIn === "file_count") return task.file_count ?? 0;
    if (col.builtIn === "qa_status") return <span className="capitalize">{task.qa_status}</span>;
    if (col.builtIn === "progress") return <Progress value={taskProgress(task)} className="h-2 w-20" />;
    return custom[col.id] ?? "—";
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col">
      <div className="border-b bg-gradient-to-br from-background via-background to-muted/30 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
              <Badge variant="outline" className="capitalize">
                {project.status}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {project.priority}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {project.description?.split("[[FLOW_WORKSPACE")[0]?.trim() || "Project workspace"}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {dept && <span>{dept.name}</span>}
              {owner && <span>Owner: {owner.full_name}</span>}
              {project.due_date && <span>Due {project.due_date}</span>}
              <span>{sections.length} sections</span>
              <span>{allProjectTasks.length} tasks</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDeleteProject && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={deleteProject}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete project
              </Button>
            )}
            {(["tasks", "forecast", "qa", "activity"] as const).map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={view === tab ? "default" : "outline"}
                onClick={() => setView(tab)}
              >
                {tab === "tasks" && "Tasks"}
                {tab === "forecast" && "Forecast"}
                {tab === "qa" && `QA (${qaQueue})`}
                {tab === "activity" && "Activity"}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="rounded-lg border bg-card/80 p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold tabular-nums",
                  kpi.tone === "success" && "text-emerald-600",
                  kpi.tone === "warn" && "text-amber-600",
                  kpi.tone === "danger" && "text-destructive"
                )}
              >
                {kpi.value}
              </p>
              {kpi.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.hint}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Sections
          </p>
          {sections.map((section) => {
            const count = workPackages.filter((t) => t.manufacturer_id === section.id).length;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSectionId(section.id);
                  setView("tasks");
                }}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition",
                  activeSectionId === section.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <span className="font-medium">{section.name}</span>
                <span className="ml-1 text-xs opacity-80">({count})</span>
              </button>
            );
          })}
          {canEdit && (
            <div className="flex gap-1 pt-2">
              <Input
                placeholder="New section"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="h-8 text-xs"
              />
              <Button size="icon-sm" variant="outline" disabled={pending} onClick={addSection}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 overflow-auto p-4 lg:p-6">
          {view === "forecast" && (
            <div className="max-w-3xl">
              <ProjectForecastPanel project={project} />
            </div>
          )}

          {view === "qa" && (
            <div className="space-y-4 max-w-3xl">
              {canViewValidation && validationMetrics && (
                <ProjectValidationPanel
                  metrics={validationMetrics}
                  canViewValidation={canViewValidation}
                />
              )}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tasks waiting for or in QA review. Full QA workflow runs in QA Center.
                </p>
                {allProjectTasks
                  .filter((t) => t.status === "ready_for_qa" || t.status === "in_qa")
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className="w-full rounded-lg border p-3 text-left hover:bg-muted/40"
                    >
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {t.status.replace(/_/g, " ")}
                      </p>
                    </button>
                  ))}
                {qaQueue === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tasks in QA queue for this project.
                  </p>
                )}
              </div>
            </div>
          )}

          {view === "activity" && (
            <div className="space-y-2 max-w-3xl">
              {projectActivity.map((e) => (
                <div key={e.id} className="rounded-md border px-3 py-2 text-sm">
                  <p>{e.summary}</p>
                  <p className="text-xs text-muted-foreground">{e.created_at}</p>
                </div>
              ))}
              {projectActivity.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity yet.</p>
              )}
            </div>
          )}

          {view === "tasks" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {sectionTasks.length} task{sectionTasks.length === 1 ? "" : "s"} in{" "}
                  {sections.find((s) => s.id === activeSectionId)?.name ?? "section"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={taskSort}
                    onChange={(e) => setTaskSort(e.target.value as TaskSort)}
                    aria-label="Sort tasks"
                  >
                    <option value="default">Sort: Default order</option>
                    <option value="title-asc">Sort: A → Z</option>
                    <option value="title-desc">Sort: Z → A</option>
                  </select>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setColumnDialogOpen(true)}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Columns
                      </Button>
                      <div className="flex gap-1">
                        <Input
                          placeholder="Add task…"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="h-8 w-48"
                          onKeyDown={(e) => e.key === "Enter" && addTask()}
                        />
                        <Button size="sm" disabled={pending || !activeSectionId} onClick={addTask}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {visibleColumns.map((col) => (
                        <th
                          key={col.id}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                          style={{ width: col.width }}
                        >
                          {col.builtIn === "title" ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                              onClick={() => setTaskSort((s) => nextTitleSort(s))}
                              title="Sort by task name"
                            >
                              {col.label}
                              {taskSort === "title-asc" && (
                                <ArrowDownAZ className="h-3.5 w-3.5 text-primary" />
                              )}
                              {taskSort === "title-desc" && (
                                <ArrowUpAZ className="h-3.5 w-3.5 text-primary" />
                              )}
                            </button>
                          ) : (
                            col.label
                          )}
                        </th>
                      ))}
                      {canDeleteTask && (
                        <th className="px-3 py-2 w-10" aria-label="Actions" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSectionTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        {visibleColumns.map((col) => (
                          <td key={col.id} className="px-3 py-2 align-middle">
                            {renderCell(task, col)}
                          </td>
                        ))}
                        {canDeleteTask && (
                          <td className="px-2 py-2 align-middle">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={pending}
                              title={`Delete ${task.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {sortedSectionTasks.length === 0 && (
                      <tr>
                        <td
                          colSpan={visibleColumns.length + (canDeleteTask ? 1 : 0)}
                          className="px-3 py-10 text-center text-muted-foreground"
                        >
                          No tasks yet. Add your first task above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      <WorkspaceColumnSettings
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        columns={config.columns}
        onSave={refreshColumns}
      />

      <WorkspaceTaskDetailSheet
        task={selectedTask}
        analysts={analysts}
        managers={managers}
        canEdit={canEdit}
        canDelete={canDeleteTask}
        columns={config.columns}
        forecastSettings={forecastSettings}
        showForecastFields={config.tracking.forecasting || config.tracking.fileUploads}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={() => {
          startTransition(async () => {});
          router.refresh();
        }}
        onDeleted={() => {
          setSelectedTaskId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
