"use client";

import { useMemo, useState, useTransition, useEffect, type ReactNode } from "react";
import {
  archiveManufacturerAction,
  archiveProjectAction,
  bulkCreateYearsAction,
  createManufacturerAction,
  createYearAction,
  deleteManufacturerAction,
  deleteProjectAction,
  deleteYearAction,
  unarchiveProjectAction,
  updateYearAction,
} from "@/app/actions/crud";
import { ProjectForecastPanel } from "@/components/forecast/project-forecast-panel";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { AddWorkPackageDialog } from "@/components/projects/add-work-package-dialog";
import { EditManufacturerDialog } from "@/components/projects/edit-manufacturer-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import {
  ProjectPortfolioDetailPanel,
  type PortfolioSelection,
} from "@/components/projects/project-portfolio-detail-panel";
import { ProjectPortfolioKpis } from "@/components/projects/project-portfolio-kpis";
import { NewWorkWizard } from "@/components/work-creation/new-work-wizard";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogFooter,
  WizardDialogHeader,
  WizardDialogScroll,
} from "@/components/ui/wizard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WORK_PRIORITIES, WORK_STATUSES } from "@/lib/constants";
import { DUE_DATE_STATUS_HINTS } from "@/lib/forecast/constants";
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
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import { YEAR_RANGE } from "@/lib/templates/project-templates";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
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
  highlightProjectId?: string;
}

const FILTER_CHIPS: { id: PortfolioFilter; label: string }[] = [
  { id: "all", label: "All Projects" },
  { id: "behind_capacity", label: "Behind Capacity" },
  { id: "due_soon", label: "Due Soon" },
  { id: "missing_tasks", label: "Missing Tasks" },
  { id: "ready_for_qa", label: "Ready for QA" },
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
  highlightProjectId,
}: ProjectWorkspaceProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(
    initialProjectId ?? activeProjects[0]?.id ?? null
  );
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter | "hours_sort">("all");
  const [selection, setSelection] = useState<PortfolioSelection>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialProjectId) return;
    const project = activeProjects.find((p) => p.id === initialProjectId);
    if (!project) return;
    setExpandedProject(initialProjectId);
    setSelection({ kind: "project", projectId: initialProjectId });
  }, [initialProjectId, activeProjects]);

  const allowedModes = user ? getAllowedCreationModes(user.role) : [];

  const kpis = useMemo(
    () => buildPortfolioKpis(activeProjects, workPackages, yearItems, allMfrs),
    [activeProjects, workPackages, yearItems, allMfrs]
  );

  const filteredProjects = useMemo(() => {
    const pool =
      portfolioFilter === "archived"
        ? archivedProjects
        : filterProjectsForPortfolio(
            [...activeProjects, ...archivedProjects],
            portfolioFilter === "hours_sort" ? "all" : portfolioFilter,
            workPackages,
            yearItems,
            allMfrs
          );

    if (portfolioFilter === "hours_sort") {
      return [...pool].sort(
        (a, b) => Number(b.estimated_total_hours ?? 0) - Number(a.estimated_total_hours ?? 0)
      );
    }
    return pool;
  }, [activeProjects, archivedProjects, portfolioFilter, workPackages, yearItems, allMfrs]);

  const atRiskProjects = useMemo(
    () =>
      activeProjects.filter((p) =>
        ["behind_capacity", "at_risk"].includes(p.project_due_date_status ?? "")
      ),
    [activeProjects]
  );

  const setFilter = (filter: PortfolioFilter | "hours_sort") => {
    setPortfolioFilter(filter);
    if (filter === "archived" && archivedProjects[0]) {
      setExpandedProject(archivedProjects[0].id);
    }
  };

  return (
    <div className="flow-project-portfolio space-y-6">
      <ProjectPortfolioKpis kpis={kpis} activeFilter={portfolioFilter} onFilter={setFilter} />

      {atRiskProjects.length > 0 && portfolioFilter !== "archived" && (
        <section className="enterprise-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Project Health & Risk</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter("behind_capacity")}
            >
              View all at risk
            </Button>
          </div>
          <ul className="space-y-2">
            {atRiskProjects.slice(0, 4).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  className="font-medium hover:text-primary text-left"
                  onClick={() => {
                    setExpandedProject(p.id);
                    setSelection({ kind: "project", projectId: p.id });
                  }}
                >
                  {p.name}
                </button>
                <DueDateStatusBadge status={p.project_due_date_status} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {DUE_DATE_STATUS_HINTS.behind_capacity}
          </p>
        </section>
      )}

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
              {chip.id === "behind_capacity" && kpis.behindCapacity > 0 && (
                <span className="ml-1.5 tabular-nums opacity-80">{kpis.behindCapacity}</span>
              )}
              {chip.id === "ready_for_qa" && kpis.readyForQa > 0 && (
                <span className="ml-1.5 tabular-nums opacity-80">{kpis.readyForQa}</span>
              )}
            </Button>
          ))}
        </div>
        {canEdit && user && allowedModes.length > 0 && (
          <NewWorkWizard
            user={user}
            departments={departments}
            teams={teams}
            projects={activeProjects}
            analysts={analysts}
            managers={managers}
            forecastSettings={forecastSettings}
            workPackages={workPackages}
          />
        )}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="enterprise-panel p-10 text-center text-sm text-muted-foreground">
          {portfolioFilter === "archived"
            ? "No archived projects in your scope."
            : "No projects match this filter. Try another view or create a new project."}
        </div>
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
                  archived && "opacity-85",
                  highlightProjectId === project.id && "ring-1 ring-primary/40"
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
                          {project.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {departmentLabel(project, departments)} · {formatProjectType(project.project_type)}
                        </p>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {archived && <Badge variant="outline">Archived</Badge>}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium",
                          nextActionClass(nextAction.tone)
                        )}
                        title="Suggested next step for this project"
                      >
                        Next: {nextAction.label}
                      </span>
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
                    {canEdit && (
                      <>
                        <EditProjectDialog
                          project={project}
                          managers={managers}
                          forecastSettings={forecastSettings}
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
                    {!archived && canEdit && (
                      <AddManufacturerDialog projectId={project.id} analysts={analysts} />
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
                        <p>This project has no manufacturers yet.</p>
                        <p className="mt-1">Add a manufacturer to begin building the work structure.</p>
                        {canEdit && (
                          <div className="mt-4 flex justify-center">
                            <AddManufacturerDialog projectId={project.id} analysts={analysts} />
                          </div>
                        )}
                      </div>
                    ) : (
                      mfrs.map((mfr) => (
                        <ManufacturerPanel
                          key={mfr.id}
                          mfr={mfr}
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
                        {archivedMfrs.length} archived manufacturer(s) hidden
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
        manufacturers={allMfrs}
        yearItems={yearItems}
        packages={workPackages}
        departments={departments}
        analysts={analysts}
        qaReviews={qaReviews}
        activity={activity}
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
            <span>{years.length} years</span>
            <span>{packages.length} tasks</span>
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
                title="Archive manufacturer"
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
              Delete Manufacturer
            </Button>
          )}
        </div>
      </div>

      {years.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
          <p>No years have been added for this manufacturer.</p>
          {canEdit && (
            <div className="mt-3 flex justify-center gap-2">
              <AddYearDialog mfr={mfr} />
              <BulkYearsDialog mfr={mfr} />
            </div>
          )}
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <AddYearDialog mfr={mfr} />
              <BulkYearsDialog mfr={mfr} />
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
                  <SelectValue placeholder="Assign user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
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

function AddYearDialog({ mfr }: { mfr: Manufacturer }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs" />}>
        <Plus className="h-3 w-3 mr-1" />
        Add Year
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Add Year — {mfr.name}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const year = Number((new FormData(e.currentTarget).get("year") as string));
            startTransition(async () => {
              await createYearAction({
                project_id: mfr.project_id,
                manufacturer_id: mfr.id,
                year,
                status: "not_started",
                priority: "medium",
                estimated_hours: 8,
              });
              setOpen(false);
            });
          }}
        >
          <div className="space-y-2 py-2">
            <Label>Model year</Label>
            <Input name="year" type="number" min={1990} max={2035} required defaultValue={2026} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkYearsDialog({ mfr }: { mfr: Manufacturer }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number[]>([...YEAR_RANGE]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs" />}>
        Bulk Add Years
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Years — {mfr.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2 py-2">
          {YEAR_RANGE.map((y) => (
            <label key={y} className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={selected.includes(y)}
                onCheckedChange={() =>
                  setSelected((prev) =>
                    prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y].sort()
                  )
                }
              />
              {y}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={pending || selected.length === 0}
            onClick={() =>
              startTransition(async () => {
                await bulkCreateYearsAction(mfr.id, mfr.project_id, selected);
                setOpen(false);
              })
            }
          >
            Create {selected.length} years
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddManufacturerDialog({
  projectId,
  analysts,
}: {
  projectId: string;
  analysts: User[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2025, 2026]);

  function toggleYear(year: number) {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort()
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const owner = fd.get("assigned_to") as string;
    startTransition(async () => {
      await createManufacturerAction(
        {
          project_id: projectId,
          name: fd.get("name") as string,
          assigned_to: owner && owner !== "__none__" ? owner : null,
          status: fd.get("status") as WorkStatus,
          priority: fd.get("priority") as import("@/types/flow").WorkPriority,
          due_date: (fd.get("due_date") as string) || null,
          notes: (fd.get("notes") as string) || null,
        },
        selectedYears
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Manufacturer
      </DialogTrigger>
      <WizardDialogContent size="md">
        <WizardDialogHeader>
          <DialogTitle>Add Manufacturer</DialogTitle>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll>
            <form id="workspace-add-manufacturer-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfr-name">Manufacturer name *</Label>
            <Input id="mfr-name" name="name" required placeholder="Toyota" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select name="assigned_to" defaultValue="__none__">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfr-due">Due date</Label>
              <Input id="mfr-due" name="due_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="not_started">
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Bulk create years</Label>
            <div className="grid grid-cols-5 gap-2">
              {YEAR_RANGE.map((year) => (
                <label key={year} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedYears.includes(year)}
                    onCheckedChange={() => toggleYear(year)}
                  />
                  {year}
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setSelectedYears([...YEAR_RANGE])}
            >
              Select all 2017–2026
            </Button>
            </div>
            </form>
          </WizardDialogScroll>
          <WizardDialogFooter>
            <Button
              type="submit"
              form="workspace-add-manufacturer-form"
              disabled={pending || selectedYears.length === 0}
            >
              {pending ? "Adding…" : `Add & create ${selectedYears.length} years`}
            </Button>
          </WizardDialogFooter>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
