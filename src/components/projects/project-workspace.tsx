"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, useEffect, type ReactNode } from "react";
import {
  archiveManufacturerAction,
  archiveProjectAction,
  deleteManufacturerAction,
  deleteProjectAction,
  deleteYearAction,
  unarchiveProjectAction,
  updateYearAction,
} from "@/app/actions/crud";
import {
  AddManufacturerDialog,
  AddYearDialog,
  BulkYearsDialog,
} from "@/components/operations/operations-dialogs";
import { ProjectForecastPanel } from "@/components/forecast/project-forecast-panel";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { AddWorkPackageDialog } from "@/components/projects/add-work-package-dialog";
import { EditManufacturerDialog } from "@/components/projects/edit-manufacturer-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import {
  ProjectPortfolioDetailPanel,
  type PortfolioSelection,
} from "@/components/projects/project-portfolio-detail-panel";
import { ProjectPortfolioCards } from "@/components/projects/project-portfolio-cards";
import { PortfolioIntelligenceStrip } from "@/components/projects/portfolio-intelligence-strip";
import { ProgramIntelligencePanel } from "@/components/projects/program-intelligence-panel";
import { ProjectPortfolioKpis } from "@/components/projects/project-portfolio-kpis";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveUserLabel, userDisplayName } from "@/lib/users/display-name";
import { WORK_STATUSES } from "@/lib/constants";
import { formatForecastDays, formatForecastHours } from "@/lib/forecast/engine";
import {
  buildManufacturerRollupContext,
  buildPortfolioKpis,
  buildProjectRollupContext,
  departmentLabel,
  filterProjectsForPortfolio,
  formatLastActivity,
  formatProjectType,
  getManufacturerNextAction,
  getProjectNextAction,
  type PortfolioFilter,
  type PortfolioScope,
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import { ProjectPortfolioQuickActions } from "@/components/projects/project-portfolio-quick-actions";
import { BulkWorkPackagesDialog } from "@/components/work-creation/bulk-work-packages-dialog";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import { getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { ProjectNextActionBadge } from "@/components/projects/project-next-action-badge";
import { BoardTrackingBadges } from "@/components/projects/board-tracking-badges";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  Department,
  ForecastSettings,
  Manufacturer,
  QaReview,
  Team,
  User,
  WorkPackage,
  WorkStatus,
  YearWorkItem,
} from "@/types/flow";
import {
  LayoutGrid,
  ListTree,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Eye,
  Factory,
  Plus,
  Trash2,
} from "lucide-react";

interface ProjectWorkspaceProps {
  projects: ProjectWithStats[];
  archivedProjects: ProjectWithStats[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  workPackages: WorkPackage[];
  managers: User[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  canDelete: boolean;
  user?: User;
  departments?: Department[];
  teams?: Team[];
  qaReviews?: QaReview[];
  activity?: ActivityEvent[];
  initialProjectId?: string;
  /** Canonical program page — hides portfolio chrome, keeps structure tree. */
  singleProjectMode?: boolean;
  /** Portfolio landing view — cards (default) or inline structure tree. */
  initialPortfolioView?: PortfolioViewMode;
}

export type PortfolioViewMode = "cards" | "structure";

const FILTER_CHIPS: { id: PortfolioFilter; label: string }[] = [
  { id: "all", label: "All Projects" },
  { id: "my_department", label: "My Department" },
  { id: "my_team", label: "My Team" },
  { id: "at_risk", label: "At Risk" },
  { id: "due_soon", label: "Due Soon" },
  { id: "ready_for_qa", label: "Ready For QA" },
  { id: "open_tasks", label: "Open Tasks" },
  { id: "missing_estimates", label: "Missing Estimates" },
  { id: "forecasted_late", label: "Forecasted Late" },
  { id: "missing_tasks", label: "Missing Tasks" },
  { id: "archived", label: "Archived" },
];

function nextActionClass(tone: ReturnType<typeof getProjectNextAction>["tone"]) {
  switch (tone) {
    case "danger":
      return "text-red-400 border-red-500/30 bg-red-500/10";
    case "warn":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "success":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    default:
      return "text-muted-foreground border-border/50 bg-muted/20";
  }
}

export function ProjectWorkspace({
  projects: activeProjects,
  archivedProjects,
  manufacturers: allMfrs,
  yearItems,
  workPackages,
  managers,
  analysts,
  forecastSettings,
  canEdit,
  canDelete,
  user,
  departments = [],
  teams = [],
  qaReviews = [],
  activity = [],
  initialProjectId,
  singleProjectMode = false,
  initialPortfolioView = "cards",
}: ProjectWorkspaceProps) {
  const [portfolioView, setPortfolioView] = useState<PortfolioViewMode>(
    singleProjectMode ? "structure" : initialPortfolioView
  );
  const [expandedProject, setExpandedProject] = useState<string | null>(
    initialProjectId ?? activeProjects[0]?.id ?? null
  );
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter | "hours_sort">("all");
  const [departmentScopeId, setDepartmentScopeId] = useState<string | null | undefined>(undefined);
  const [selection, setSelection] = useState<PortfolioSelection>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialProjectId) return;
    const project = activeProjects.find((p) => p.id === initialProjectId);
    if (!project) return;
    setExpandedProject(initialProjectId);
    setSelection({ kind: "project", projectId: initialProjectId });
  }, [initialProjectId, activeProjects]);

  const kpis = useMemo(
    () => buildPortfolioKpis(activeProjects, workPackages, yearItems, allMfrs),
    [activeProjects, workPackages, yearItems, allMfrs]
  );

  const portfolioScope = useMemo((): PortfolioScope | undefined => {
    if (departmentScopeId !== undefined) {
      return { departmentId: departmentScopeId };
    }
    if (portfolioFilter === "my_team" && user?.team_id) {
      return { teamId: user.team_id };
    }
    if (portfolioFilter === "my_department" && user?.team_id) {
      const deptId = teams.find((t) => t.id === user.team_id)?.department_id;
      if (deptId) return { departmentId: deptId };
    }
    return undefined;
  }, [departmentScopeId, portfolioFilter, user?.team_id, teams]);

  const filteredProjects = useMemo(() => {
    const pool =
      portfolioFilter === "archived"
        ? archivedProjects
        : filterProjectsForPortfolio(
            [...activeProjects, ...archivedProjects],
            portfolioFilter === "hours_sort" ? "all" : portfolioFilter,
            workPackages,
            yearItems,
            allMfrs,
            portfolioScope
          );

    if (portfolioFilter === "hours_sort") {
      return [...pool].sort(
        (a, b) => Number(b.estimated_total_hours ?? 0) - Number(a.estimated_total_hours ?? 0)
      );
    }
    return pool;
  }, [activeProjects, archivedProjects, portfolioFilter, workPackages, yearItems, allMfrs, portfolioScope]);

  const singleProject = useMemo(() => {
    if (!singleProjectMode || !initialProjectId) return null;
    return filteredProjects.find((p) => p.id === initialProjectId) ?? activeProjects.find((p) => p.id === initialProjectId);
  }, [singleProjectMode, initialProjectId, filteredProjects, activeProjects]);

  const setFilter = (filter: PortfolioFilter | "hours_sort") => {
    setPortfolioFilter(filter);
    if (filter === "archived" && archivedProjects[0]) {
      setExpandedProject(archivedProjects[0].id);
    }
  };

  const canCreateTask = Boolean(
    user && canEdit && getAllowedCreationModes(user.role).includes("task")
  );

  return (
    <div className="flow-project-portfolio space-y-6">
      {!singleProjectMode && (
        <ProjectPortfolioKpis kpis={kpis} activeFilter={portfolioFilter} onFilter={setFilter} />
      )}

      {!singleProjectMode && (
        <PortfolioIntelligenceStrip
          projects={activeProjects}
          packages={workPackages}
          manufacturers={allMfrs}
          yearItems={yearItems}
          qaReviews={qaReviews}
          activity={activity}
          forecastSettings={forecastSettings}
          departments={departments}
          onSelectProject={(projectId) => {
            setPortfolioView("structure");
            setExpandedProject(projectId);
            setSelection({ kind: "project", projectId });
          }}
          onSelectDepartment={(departmentId) => {
            setDepartmentScopeId(departmentId);
            setPortfolioFilter("all");
            setPortfolioView("cards");
          }}
        />
      )}

      {singleProjectMode && singleProject && (
        <ProgramIntelligencePanel
          project={singleProject}
          packages={workPackages}
          manufacturers={allMfrs}
          yearItems={yearItems}
          qaReviews={qaReviews}
          activity={activity}
          forecastSettings={forecastSettings}
          user={user}
          projects={activeProjects}
          analysts={analysts}
        />
      )}

      {!singleProjectMode && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              size="sm"
              variant={portfolioFilter === chip.id ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
              {chip.id === "at_risk" && kpis.projectsAtRisk > 0 && (
                <span className="ml-1.5 tabular-nums opacity-80">{kpis.projectsAtRisk}</span>
              )}
              {chip.id === "ready_for_qa" && kpis.readyForQa > 0 && (
                <span className="ml-1.5 tabular-nums opacity-80">{kpis.readyForQa}</span>
              )}
            </Button>
          ))}
        </div>
        <div className="flex rounded-md border border-border/60 p-0.5 bg-muted/20">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 text-xs px-2.5 border-transparent bg-transparent shadow-none",
              portfolioView === "cards" && "flow-segment-active"
            )}
            onClick={() => setPortfolioView("cards")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" />
            Programs
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 text-xs px-2.5 border-transparent bg-transparent shadow-none",
              portfolioView === "structure" && "flow-segment-active"
            )}
            onClick={() => setPortfolioView("structure")}
          >
            <ListTree className="h-3.5 w-3.5 mr-1" />
            Structure
          </Button>
        </div>
      </div>
      )}

      {filteredProjects.length === 0 ? (
        <div className="enterprise-panel p-10 text-center text-sm text-muted-foreground">
          {portfolioFilter === "archived"
            ? "No archived projects in your scope."
            : "No projects match this filter. Try another view or create a new project."}
        </div>
      ) : portfolioView === "cards" && !singleProjectMode ? (
        <ProjectPortfolioCards
          projects={filteredProjects}
          manufacturers={allMfrs}
          yearItems={yearItems}
          workPackages={workPackages}
          departments={departments}
          forecastSettings={forecastSettings}
          qaReviews={qaReviews}
          activity={activity}
          user={user}
          allProjects={activeProjects}
          analysts={analysts}
          canCreateTask={canCreateTask}
          onSelectProject={(projectId) => {
            setPortfolioView("structure");
            setExpandedProject(projectId);
            setSelection({ kind: "project", projectId });
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const open = expandedProject === project.id;
            const archived = project.status === "archived";
            const mfrs = allMfrs.filter((m) => m.project_id === project.id && !m.is_archived);
            const archivedMfrs = allMfrs.filter((m) => m.project_id === project.id && m.is_archived);
            const rollup = buildProjectRollupContext(
              project,
              workPackages,
              allMfrs,
              yearItems,
              qaReviews,
              activity
            );
            const nextAction = getProjectNextAction(project, allMfrs, yearItems, workPackages);
            const labels = getProjectHierarchyLabels(project);
            const primaryDue =
              project.active_project_due_date ??
              project.manual_project_due_date ??
              project.due_date ??
              project.suggested_project_due_date ??
              "—";

            return (
              <article
                key={project.id}
                id={`project-${project.id}`}
                className={cn(
                  "enterprise-panel overflow-hidden scroll-mt-24",
                  archived && "opacity-85"
                )}
              >
                <header className="p-4 border-b border-border/50 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex items-start gap-2 min-w-0 text-left group"
                      onClick={() => setExpandedProject(open ? null : project.id)}
                    >
                      {open ? (
                        <ChevronDown className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold truncate group-hover:text-primary transition-colors">
                          {singleProjectMode ? (
                            project.name
                          ) : (
                            <Link
                              href={`/projects/${project.id}`}
                              prefetch={false}
                              className="hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {project.name}
                            </Link>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {departmentLabel(project, departments)} · {formatProjectType(project.project_type)}
                        </p>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {archived && <Badge variant="outline">Archived</Badge>}
                      <BoardTrackingBadges project={project} />
                      {user && !archived ? (
                        <ProjectNextActionBadge
                          action={nextAction}
                          project={project}
                          projects={activeProjects}
                          manufacturers={allMfrs}
                          yearItems={yearItems}
                          analysts={analysts}
                          forecastSettings={forecastSettings}
                          user={user}
                        />
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium",
                            nextActionClass(nextAction.tone)
                          )}
                          title="Suggested next step for this project"
                        >
                          Next: {nextAction.label}
                        </span>
                      )}
                      <DueDateStatusBadge status={project.project_due_date_status} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 text-xs">
                    <Metric label="Progress" value={`${project.completedPct}%`} />
                    <Metric
                      label="Planning Due Date"
                      value={project.planning_project_due_date ?? project.suggested_project_due_date ?? "—"}
                    />
                    <Metric label="Primary Due Date" value={primaryDue} />
                    <Metric
                      label="Total Documents"
                      value={project.estimated_total_documents?.toLocaleString() ?? "—"}
                    />
                    <Metric
                      label="Estimated Hours"
                      value={formatForecastHours(project.estimated_total_hours)}
                    />
                    <Metric
                      label="Estimated Work Days"
                      value={formatForecastDays(project.estimated_total_work_days)}
                    />
                    <Metric
                      label="Forecast Confidence"
                      value={`${project.forecast_confidence ?? 0}%`}
                      title="How reliable the forecast is based on available estimates"
                    />
                    <Metric
                      label="Last Activity"
                      value={formatLastActivity(rollup.lastActivityAt)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                    {canEdit && user && (
                      <>
                        <EditProjectDialog
                          project={project}
                          managers={managers}
                          forecastSettings={forecastSettings}
                          viewer={user}
                        />
                        {archived ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={pending}
                            onClick={() => startTransition(() => unarchiveProjectAction(project.id))}
                          >
                            <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Archive "${project.name}"?`)) {
                                startTransition(() => archiveProjectAction(project.id));
                              }
                            }}
                          >
                            <Archive className="h-3.5 w-3.5 mr-1" />
                            Archive
                          </Button>
                        )}
                      </>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Delete "${project.name}" and all children?`)) {
                            startTransition(() => deleteProjectAction(project.id));
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                    {!archived && (
                      <ProjectPortfolioQuickActions
                        project={project}
                        user={user}
                        projects={activeProjects}
                        manufacturers={allMfrs}
                        yearItems={yearItems}
                        analysts={analysts}
                        forecastSettings={forecastSettings}
                        canCreateTask={canCreateTask}
                      />
                    )}
                    {!archived && canEdit && (
                      <>
                        <AddManufacturerDialog
                          projectId={project.id}
                          projectType={project.project_type}
                          structureMode={project.structure_mode}
                          analysts={analysts}
                        />
                        <BulkWorkPackagesDialog
                          projectId={project.id}
                          labels={labels}
                          projectType={project.project_type}
                        />
                      </>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 ml-auto"
                      onClick={() => setSelection({ kind: "project", projectId: project.id })}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View Details
                    </Button>
                  </div>
                </header>

                {open && !archived && (
                  <div className="p-4 space-y-4 bg-muted/5">
                    <ProjectForecastPanel project={project} />
                    {mfrs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                        <p>This project has no {labels.workPackagePlural.toLowerCase()} yet.</p>
                        <p className="mt-1">
                          Add a {labels.workPackageShort.toLowerCase()} to begin building the work
                          structure.
                        </p>
                        {canEdit && (
                          <div className="mt-4 flex justify-center gap-2 flex-wrap">
                            <AddManufacturerDialog
                              projectId={project.id}
                              projectType={project.project_type}
                              structureMode={project.structure_mode}
                              analysts={analysts}
                            />
                            <BulkWorkPackagesDialog
                              projectId={project.id}
                              labels={labels}
                              projectType={project.project_type}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      mfrs.map((mfr) => (
                        <ManufacturerPanel
                          key={mfr.id}
                          mfr={mfr}
                          projectType={project.project_type}
                          structureMode={project.structure_mode}
                          labels={labels}
                          years={yearItems.filter((y) => y.manufacturer_id === mfr.id)}
                          packages={workPackages.filter((p) => p.manufacturer_id === mfr.id)}
                          allWorkPackages={workPackages}
                          allProjects={activeProjects}
                          teams={teams}
                          viewer={user}
                          departments={departments}
                          analysts={analysts}
                          forecastSettings={forecastSettings}
                          qaReviews={qaReviews}
                          activity={activity}
                          yearItems={yearItems}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          pending={pending}
                          startTransition={startTransition}
                          onSelectManufacturer={() =>
                            setSelection({
                              kind: "manufacturer",
                              projectId: project.id,
                              manufacturerId: mfr.id,
                            })
                          }
                          onSelectYear={(yearId) =>
                            setSelection({
                              kind: "year",
                              projectId: project.id,
                              manufacturerId: mfr.id,
                              yearId,
                            })
                          }
                          onSelectTask={(packageId) =>
                            setSelection({
                              kind: "task",
                              projectId: project.id,
                              packageId,
                            })
                          }
                        />
                      ))
                    )}
                    {archivedMfrs.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {archivedMfrs.length} archived {labels.workPackagePlural.toLowerCase()} hidden
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ProjectPortfolioDetailPanel
        selection={selection}
        onClose={() => setSelection(null)}
        projects={[...activeProjects, ...archivedProjects]}
        allProjects={activeProjects}
        manufacturers={allMfrs}
        yearItems={yearItems}
        packages={workPackages}
        departments={departments}
        analysts={analysts}
        qaReviews={qaReviews}
        activity={activity}
        viewer={user}
        canEdit={canEdit}
        canDelete={canDelete}
        canCreateTask={canCreateTask}
        forecastSettings={forecastSettings}
        managers={managers}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  title,
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div title={title}>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

function ManufacturerPanel({
  mfr,
  projectType,
  structureMode,
  labels,
  years,
  packages,
  allWorkPackages,
  allProjects,
  teams,
  viewer,
  departments = [],
  analysts,
  forecastSettings,
  qaReviews,
  activity,
  yearItems,
  canEdit,
  canDelete,
  pending,
  startTransition,
  onSelectManufacturer,
  onSelectYear,
  onSelectTask,
}: {
  mfr: Manufacturer;
  projectType?: string | null;
  structureMode?: string | null;
  labels: import("@/lib/work-packages/smart-labels").SmartHierarchyLabels;
  years: YearWorkItem[];
  packages: WorkPackage[];
  allWorkPackages: WorkPackage[];
  allProjects: ProjectWithStats[];
  teams: Team[];
  viewer?: User;
  departments?: Department[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  yearItems: YearWorkItem[];
  canEdit: boolean;
  canDelete: boolean;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onSelectManufacturer: () => void;
  onSelectYear: (yearId: string) => void;
  onSelectTask: (packageId: string) => void;
}) {
  const rollup = buildManufacturerRollupContext(mfr, packages, yearItems, qaReviews, activity);
  const nextAction = getManufacturerNextAction(mfr, years, packages);
  const issueCount = rollup.correctionCount + rollup.overdueCount;

  return (
    <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <Factory className="h-4 w-4 text-indigo-400 shrink-0" />
            <button type="button" className="hover:text-primary truncate" onClick={onSelectManufacturer}>
              {mfr.name}
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span>{years.length} {labels.phasePlural.toLowerCase()}</span>
            <span>{packages.length} {labels.taskPlural.toLowerCase()}</span>
            <span>{rollup.completedPct}% progress</span>
            <span>{rollup.readyForQa} ready for QA</span>
            {issueCount > 0 && <span className="text-amber-400">{issueCount} issues</span>}
          </div>
          <span
            className={cn(
              "inline-flex mt-2 items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium",
              nextActionClass(nextAction.tone)
            )}
          >
            Next: {nextAction.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectManufacturer}>
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>
          {canEdit && (
            <>
              <EditManufacturerDialog manufacturer={mfr} analysts={analysts} />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={pending}
                title={`Archive ${labels.workPackageShort.toLowerCase()}`}
                onClick={() => {
                  if (confirm(`Archive ${mfr.name}?`)) {
                    startTransition(() => archiveManufacturerAction(mfr.id));
                  }
                }}
              >
                <Archive className="h-3 w-3 mr-1" />
                Archive
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete ${mfr.name}?`)) {
                  startTransition(() => deleteManufacturerAction(mfr.id));
                }
              }}
            >
              Delete {labels.workPackageShort}
            </Button>
          )}
        </div>
      </div>

      {years.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
          <p>No {labels.phasePlural.toLowerCase()} have been added for this {labels.workPackageShort.toLowerCase()}.</p>
          {canEdit && (
            <div className="mt-3 flex justify-center gap-2">
              <AddYearDialog
                projectId={mfr.project_id}
                projectType={projectType}
                structureMode={structureMode}
                manufacturerId={mfr.id}
                trigger={
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add {labels.phaseShort}
                  </Button>
                }
              />
              <BulkYearsDialog
                mfr={mfr}
                projectType={projectType}
                structureMode={structureMode}
                trigger={
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Bulk Add {labels.phasePlural}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <AddYearDialog
                projectId={mfr.project_id}
                projectType={projectType}
                structureMode={structureMode}
                manufacturerId={mfr.id}
                trigger={
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add {labels.phaseShort}
                  </Button>
                }
              />
              <BulkYearsDialog
                mfr={mfr}
                projectType={projectType}
                structureMode={structureMode}
                trigger={
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Bulk Add {labels.phasePlural}
                  </Button>
                }
              />
            </div>
          )}
          <div className="space-y-2">
            {years
              .sort((a, b) => b.year - a.year)
              .map((y) => (
                <YearRow
                  key={y.id}
                  yearItem={y}
                  manufacturerName={mfr.name}
                  packages={packages.filter((p) => p.year_work_item_id === y.id)}
                  allWorkPackages={allWorkPackages}
                  allProjects={allProjects}
                  teams={teams}
                  viewer={viewer}
                  departments={departments}
                  analysts={analysts}
                  forecastSettings={forecastSettings}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  pending={pending}
                  startTransition={startTransition}
                  onSelectYear={() => onSelectYear(y.id)}
                  onSelectTask={onSelectTask}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function YearRow({
  yearItem,
  manufacturerName,
  packages,
  allWorkPackages,
  allProjects,
  teams,
  viewer,
  departments = [],
  analysts,
  forecastSettings,
  canEdit,
  canDelete,
  pending,
  startTransition,
  onSelectYear,
  onSelectTask,
}: {
  yearItem: YearWorkItem;
  manufacturerName: string;
  packages: WorkPackage[];
  allWorkPackages: WorkPackage[];
  allProjects: ProjectWithStats[];
  teams: Team[];
  viewer?: User;
  departments?: Department[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  canDelete: boolean;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onSelectYear: () => void;
  onSelectTask: (packageId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const assignee = analysts.find((a) => a.id === yearItem.assigned_to)?.full_name ?? "Unassigned";

  return (
    <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="font-medium text-sm hover:text-primary"
          onClick={() => {
            setExpanded(!expanded);
            onSelectYear();
          }}
        >
          {yearItem.year}
        </button>
        <span className="text-xs text-muted-foreground">
          {packages.length} task{packages.length === 1 ? "" : "s"}
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">· {assignee}</span>
        <StatusBadge status={yearItem.status} />
        {yearItem.due_date && (
          <span className="text-xs text-muted-foreground">Due {yearItem.due_date}</span>
        )}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {canEdit && (
            <>
              <Select
                value={yearItem.assigned_to ?? "__none__"}
                onValueChange={(v) => {
                  startTransition(() =>
                    updateYearAction(yearItem.id, {
                      assigned_to: v === "__none__" ? null : v,
                    })
                  );
                }}
              >
                <SelectTrigger className="h-7 w-[140px] text-xs" title="Assigned user">
                  <SelectValue placeholder="Assign user">
                    {resolveUserLabel(yearItem.assigned_to, analysts)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {userDisplayName(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={yearItem.status}
                onValueChange={(v) => {
                  if (v) startTransition(() => updateYearAction(yearItem.id, { status: v as WorkStatus }));
                }}
              >
                <SelectTrigger className="h-7 w-[130px] text-xs" title="Year status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AddWorkPackageDialog
                yearItem={yearItem}
                manufacturerName={manufacturerName}
                analysts={analysts}
                forecastSettings={forecastSettings}
                viewer={viewer}
                workPackages={allWorkPackages}
                projects={allProjects}
                teams={teams}
                departments={departments}
              />
            </>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => startTransition(() => deleteYearAction(yearItem.id))}
            >
              Remove Year
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        packages.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-2 border-l-2 border-border/40">
            No tasks exist for this year yet. Add a task to assign work.
          </p>
        ) : (
          <ul className="space-y-1 pl-2 border-l-2 border-border/40">
            {packages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-xs py-1 hover:text-primary text-left"
                  onClick={() => onSelectTask(p.id)}
                >
                  <span className="truncate">{p.title}</span>
                  <StatusBadge status={p.status} />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
