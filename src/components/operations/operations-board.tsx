"use client";

import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  archiveManufacturerAction,
  bulkAssignWorkPackagesAction,
  bulkDeleteWorkPackagesAction,
  bulkSubmitQaAction,
  bulkUpdateWorkPackagesAction,
  completeWorkPackageAction,
  deleteManufacturerAction,
  deleteProjectAction,
  deleteWorkPackageAction,
  deleteYearAction,
  duplicateWorkPackageAction,
  submitWorkPackageToQaAction,
  updateWorkPackageAction,
  updateYearAction,
} from "@/app/actions/crud";
import {
  AddManufacturerDialog,
  AddYearDialog,
  BulkYearsDialog,
} from "@/components/operations/operations-dialogs";
import { OperationsToolbar } from "@/components/operations/operations-toolbar";
import {
  OperationsDetailPanel,
  type OpsPanelSelection,
} from "@/components/operations/operations-detail-panel";
import { GroupHeaderMetrics } from "@/components/operations/group-header-metrics";
import { PackageDetailSheet } from "@/components/operations/package-detail-sheet";
import { formatLastActivity, RollupCells } from "@/components/operations/rollup-cells";
import { opsColCount, type OpsLayoutMode } from "@/lib/operations/layout";
import {
  buildPersonGroups,
  buildProgramGroups,
  buildTodayTasks,
  collectFilteredPackages,
  type OpsGroupingId,
} from "@/lib/operations/task-views";
import { OperationsTaskView } from "@/components/operations/operations-task-view";
import { CreateTaskComposer } from "@/components/work-creation/create-task-composer";
import { getHierarchyLabels, getProgramLabels, getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { structureCountSummary } from "@/lib/projects/hierarchy-display";
import { AddWorkPackageDialog } from "@/components/projects/add-work-package-dialog";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { userDisplayName } from "@/lib/users/display-name";
import { Textarea } from "@/components/ui/textarea";
import { useOperationsExpanded } from "@/hooks/use-operations-expanded";
import { QA_STATUSES, WORK_PRIORITIES, WORK_STATUSES, qaStatusLabel } from "@/lib/constants";
import {
  collectPackageIds,
  DEFAULT_OPS_FILTERS,
  filterOperationsTree,
  flattenManufacturers,
  flattenProjects,
  type OpsBoardFilters,
} from "@/lib/operations/board-filters";
import { isOverdue, isStuck } from "@/lib/scoring/flow-score";
import { cn } from "@/lib/utils";
import type {
  Comment,
  ForecastSettings,
  Manufacturer,
  OperationsTree,
  Project,
  QaStatus,
  TaskFileUpload,
  TimeLog,
  User,
  WorkPackage,
  WorkPriority,
  WorkStatus,
  YearWorkItem,
} from "@/types/flow";
import type { OpsSavedViewId } from "@/lib/operations/board-filters";
import { isBefore, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle,
  Archive,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  Factory,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  Package,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

interface OperationsBoardProps {
  tree: OperationsTree;
  initialSearch?: string;
  initialProjectId?: string;
  initialPackageId?: string;
  initialViewId?: OpsSavedViewId;
  initialGroupingId?: OpsGroupingId;
  taskFileUploads: TaskFileUpload[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  currentUserId: string;
  teamUserIds: string[];
  canEdit: boolean;
  canAssign: boolean;
  canManageProjects: boolean;
  canDeleteProjects: boolean;
  canDeleteWork: boolean;
  canSubmitQa: boolean;
  canEditQa: boolean;
  readOnly: boolean;
  comments: Comment[];
  timeLogs: TimeLog[];
  canCreateTask?: boolean;
  creationUser?: User;
  activeProjects?: Project[];
  scopedManufacturers?: Manufacturer[];
  scopedYearItems?: YearWorkItem[];
}

const TABLE_COL_COUNT = 14;

function isPanelSelected(selection: OpsPanelSelection | null, key: string): boolean {
  if (!selection) return false;
  switch (selection.kind) {
    case "project":
      return key === `proj-${selection.node.project.id}`;
    case "manufacturer":
      return key === `mfr-${selection.node.manufacturer.id}`;
    case "year":
      return key === `yr-${selection.node.yearWorkItem.id}`;
    case "package":
      return key === `pkg-${selection.pkg.id}`;
  }
}

function isYearOverdue(y: YearWorkItem) {
  if (!y.due_date || y.status === "done") return false;
  return isBefore(parseISO(y.due_date), startOfDay(new Date()));
}

function pkgDonePct(pkg: WorkPackage) {
  return pkg.status === "done" ? 100 : 0;
}

function flattenPackages(tree: OperationsTree): WorkPackage[] {
  const packages: WorkPackage[] = [];
  for (const project of tree.projects) {
    for (const manufacturer of project.manufacturers) {
      for (const year of manufacturer.years) {
        packages.push(...year.packages);
      }
    }
  }
  return packages;
}

export function OperationsBoard({
  tree,
  initialSearch = "",
  initialProjectId,
  initialPackageId,
  initialViewId,
  initialGroupingId = "today",
  taskFileUploads,
  analysts,
  forecastSettings,
  currentUserId,
  teamUserIds,
  canEdit,
  canAssign,
  canManageProjects,
  canDeleteProjects,
  canDeleteWork,
  canSubmitQa,
  canEditQa,
  readOnly,
  comments,
  timeLogs,
  canCreateTask = false,
  creationUser,
  activeProjects = [],
  scopedManufacturers = [],
  scopedYearItems = [],
}: OperationsBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const allowEdit = canEdit && !readOnly;
  const allowAssign = canAssign && !readOnly;
  const allowManage = canManageProjects && !readOnly;
  const showActions = allowEdit || allowAssign || canDeleteProjects || canDeleteWork || allowManage;

  const [filters, setFilters] = useState<OpsBoardFilters>({
    ...DEFAULT_OPS_FILTERS,
    search: initialSearch,
    projectId: initialProjectId,
    viewId: initialViewId ?? DEFAULT_OPS_FILTERS.viewId,
  });
  const [layoutMode, setLayoutMode] = useState<OpsLayoutMode>("browser");
  const [groupingId, setGroupingId] = useState<OpsGroupingId>(initialGroupingId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [panelSelection, setPanelSelection] = useState<OpsPanelSelection | null>(null);

  const compact = layoutMode === "browser";
  const colCount = opsColCount(compact, showActions);

  const allPackages = useMemo(() => flattenPackages(tree), [tree]);
  const resolvePackage = (id: string) => allPackages.find((p) => p.id === id);

  const syncPackageParam = useCallback(
    (packageId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (packageId) params.set("package", packageId);
      else params.delete("package");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const closePanel = useCallback(() => {
    setPanelSelection(null);
    syncPackageParam(null);
  }, [syncPackageParam]);

  const selectPackage = (pkg: WorkPackage) => {
    setPanelSelection({ kind: "package", pkg });
    syncPackageParam(pkg.id);
  };

  useEffect(() => {
    if (initialSearch) {
      setFilters((f) => ({ ...f, search: initialSearch }));
    }
  }, [initialSearch]);

  useEffect(() => {
    if (initialProjectId) {
      setFilters((f) => ({ ...f, projectId: initialProjectId }));
      setGroupingId("by_program");
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (initialGroupingId) {
      setGroupingId(initialGroupingId);
    }
  }, [initialGroupingId]);

  useEffect(() => {
    if (initialViewId) {
      setFilters((f) => ({ ...f, viewId: initialViewId }));
    }
  }, [initialViewId]);

  const syncProjectParam = useCallback(
    (projectId: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (projectId) params.set("projectId", projectId);
      else params.delete("projectId");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const syncGroupingParam = useCallback(
    (nextGrouping: OpsGroupingId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextGrouping === "today") params.delete("grouping");
      else params.set("grouping", nextGrouping);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleFiltersChange = useCallback(
    (next: OpsBoardFilters) => {
      setFilters(next);
      if (next.projectId !== filters.projectId) {
        syncProjectParam(next.projectId);
        if (next.projectId && groupingId !== "by_program") {
          setGroupingId("by_program");
          syncGroupingParam("by_program");
        }
      }
    },
    [filters.projectId, groupingId, syncProjectParam, syncGroupingParam]
  );

  useEffect(() => {
    const fromUrl = searchParams.get("projectId")?.trim();
    if (!fromUrl) return;
    setFilters((f) => (f.projectId === fromUrl ? f : { ...f, projectId: fromUrl }));
    setGroupingId((g) => (g === "by_program" ? g : "by_program"));
  }, [searchParams]);

  const handleGroupingChange = useCallback(
    (next: OpsGroupingId) => {
      setGroupingId(next);
      syncGroupingParam(next);
    },
    [syncGroupingParam]
  );

  useEffect(() => {
    const packageId = searchParams.get("package") ?? searchParams.get("taskId") ?? initialPackageId ?? null;
    if (!packageId) {
      setPanelSelection((prev) => (prev?.kind === "package" ? null : prev));
      return;
    }
    const pkg = allPackages.find((p) => p.id === packageId);
    if (pkg) setPanelSelection({ kind: "package", pkg });
  }, [searchParams, initialPackageId, allPackages]);

  const selectPanel = useCallback(
    (selection: OpsPanelSelection | null) => {
      setPanelSelection(selection);
      if (selection?.kind === "package") {
        syncPackageParam(selection.pkg.id);
      } else {
        syncPackageParam(null);
      }
    },
    [syncPackageParam]
  );

  const projectIds = useMemo(() => tree.projects.map((p) => p.project.id), [tree]);
  const { expanded, toggle, expandAll, collapseAll } = useOperationsExpanded(projectIds);

  const filteredTree = useMemo(
    () => filterOperationsTree(tree, filters, teamUserIds),
    [tree, filters, teamUserIds]
  );

  const projects = useMemo(() => flattenProjects(tree), [tree]);
  const manufacturers = useMemo(() => flattenManufacturers(tree), [tree]);

  const filteredProject = filters.projectId
    ? activeProjects.find((p) => p.id === filters.projectId) ??
      projects.find((p) => p.id === filters.projectId)
    : null;

  const taskEmptyState =
    canCreateTask && creationUser && filters.projectId && filteredProject ? (
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs">
          {filteredProject.name} has no tasks in this view yet.
        </p>
        <CreateTaskComposer
          user={creationUser}
          projects={activeProjects.length ? activeProjects : [filteredProject]}
          manufacturers={scopedManufacturers}
          yearItems={scopedYearItems}
          analysts={analysts}
          forecastSettings={forecastSettings}
          defaultProjectId={filters.projectId}
          redirectToOperationsOnCreate
          trigger={
            <Button size="sm" className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add first task
            </Button>
          }
        />
      </div>
    ) : null;

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedPkgIds = useMemo(() => {
    const fromTree = collectPackageIds(filteredTree, selected);
    if (fromTree.length > 0 || groupingId === "hierarchy") return fromTree;
    return [...selected]
      .filter((k) => k.startsWith("pkg-"))
      .map((k) => k.slice(4));
  }, [filteredTree, selected, groupingId]);

  const filteredPackages = useMemo(
    () => collectFilteredPackages(tree, filters, teamUserIds),
    [tree, filters, teamUserIds]
  );

  const todayTasks = useMemo(
    () => (groupingId === "today" ? buildTodayTasks(filteredPackages) : []),
    [groupingId, filteredPackages]
  );

  const programGroups = useMemo(
    () => (groupingId === "by_program" ? buildProgramGroups(filteredPackages) : []),
    [groupingId, filteredPackages]
  );

  const personGroups = useMemo(
    () => (groupingId === "by_person" ? buildPersonGroups(filteredPackages, analysts) : []),
    [groupingId, filteredPackages, analysts]
  );

  const activeTaskId = panelSelection?.kind === "package" ? panelSelection.pkg.id : undefined;

  const updatePkg = (id: string, updates: Partial<WorkPackage>) => {
    startTransition(async () => {
      await updateWorkPackageAction(id, updates);
    });
  };

  const updateYear = (id: string, updates: Partial<YearWorkItem>) => {
    startTransition(async () => {
      await updateYearAction(id, updates);
    });
  };

  const runBulk = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      setSelected(new Set());
    });
  };

  return (
    <>
      <div className="flow-workspace">
        <div className="flow-workspace-toolbar">
          <OperationsToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        groupingId={groupingId}
        onGroupingChange={handleGroupingChange}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        projects={projects}
        manufacturers={manufacturers}
        analysts={analysts}
        selectedCount={selectedPkgIds.length}
        canBulk={allowEdit || allowAssign}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onBulkAssign={
          allowAssign
            ? (userId) =>
                runBulk(() => bulkAssignWorkPackagesAction(selectedPkgIds, userId))
            : undefined
        }
        onBulkStatus={
          allowEdit
            ? (status) =>
                runBulk(() =>
                  bulkUpdateWorkPackagesAction(selectedPkgIds, { status: status as WorkStatus })
                )
            : undefined
        }
        onBulkPriority={
          allowEdit
            ? (priority) =>
                runBulk(() =>
                  bulkUpdateWorkPackagesAction(selectedPkgIds, { priority: priority as WorkPriority })
                )
            : undefined
        }
        onBulkDueDate={
          allowEdit
            ? (date) =>
                runBulk(() => bulkUpdateWorkPackagesAction(selectedPkgIds, { due_date: date }))
            : undefined
        }
        onBulkSubmitQa={
          canSubmitQa
            ? () => runBulk(() => bulkSubmitQaAction(selectedPkgIds))
            : undefined
        }
        onBulkArchive={
          allowManage
            ? () => {
                const mfrIds = [...selected].filter((k) => k.startsWith("mfr-")).map((k) => k.slice(4));
                if (mfrIds.length) {
                  startTransition(async () => {
                    for (const id of mfrIds) await archiveManufacturerAction(id);
                    setSelected(new Set());
                  });
                }
              }
            : undefined
        }
        onBulkDelete={
          canDeleteWork
            ? () => {
                const labels = getHierarchyLabels();
                if (
                  confirm(
                    `Delete ${selectedPkgIds.length} ${labels.taskPlural.toLowerCase()}?`
                  )
                ) {
                  runBulk(() => bulkDeleteWorkPackagesAction(selectedPkgIds));
                }
              }
            : undefined
        }
      />
        </div>

      <div className="flow-workspace-body overflow-hidden">
        <div className="flow-ops-split">
        <div className="flow-ops-table-pane">
          {groupingId !== "hierarchy" ? (
            <OperationsTaskView
              groups={
                groupingId === "by_program"
                  ? programGroups
                  : groupingId === "by_person"
                    ? personGroups
                    : null
              }
              flatTasks={groupingId === "today" ? todayTasks : null}
              showGroups={groupingId === "by_program" || groupingId === "by_person"}
              analysts={analysts}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSelectTask={selectPackage}
              activeTaskId={activeTaskId}
              emptyState={taskEmptyState}
            />
          ) : (
          <table className={cn("w-full text-sm border-separate border-spacing-0", !compact && "min-w-[1400px]")}>
            <thead className="sticky top-0 z-10 enterprise-grid-header">
              <tr className="text-xs text-muted-foreground">
                <th className="w-8 py-2.5 pl-3 bg-secondary"> </th>
                <th className="text-left font-semibold py-2.5 min-w-[240px] bg-secondary">Name</th>
                <th className="text-left font-semibold py-2.5 w-[120px] bg-secondary">Status</th>
                <th className="text-left font-semibold py-2.5 w-[118px] bg-secondary">Assigned To</th>
                <th className="text-left font-semibold py-2.5 w-[90px] bg-secondary">Priority</th>
                <th className="text-left font-semibold py-2.5 w-[100px] bg-secondary">Due Date</th>
                {!compact && (
                  <>
                    <th className="text-right font-semibold py-2.5 w-[64px] bg-secondary">Est Hrs</th>
                    <th className="text-right font-semibold py-2.5 w-[64px] bg-secondary">Act Hrs</th>
                    <th className="text-right font-semibold py-2.5 w-[48px] bg-secondary">Files</th>
                  </>
                )}
                <th className="text-right font-semibold py-2.5 w-[56px] bg-secondary">Progress</th>
                <th className="text-left font-semibold py-2.5 w-[80px] bg-secondary">QA</th>
                {!compact && (
                  <>
                    <th className="text-right font-semibold py-2.5 w-[44px] bg-secondary">Corr</th>
                    <th className="text-right font-semibold py-2.5 w-[100px] bg-secondary">Last Activity</th>
                  </>
                )}
                {showActions && <th className="w-10 py-2.5 bg-secondary" />}
              </tr>
            </thead>
            <tbody className={cn(pending && "opacity-60 pointer-events-none")}>
              {filteredTree.projects.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="py-12 text-center text-muted-foreground text-sm">
                    No work matches your filters.
                  </td>
                </tr>
              )}
              {filteredTree.projects.map((projNode) => {
                const pKey = `proj-${projNode.project.id}`;
                const pOpen = expanded[pKey] ?? false;
                return (
                  <ProjectRows
                    key={projNode.project.id}
                    node={projNode}
                    pKey={pKey}
                    pOpen={pOpen}
                    onToggle={() => toggle(pKey)}
                    expanded={expanded}
                    onToggleChild={toggle}
                    selected={selected}
                    onToggleSelect={toggleSelect}
                    analysts={analysts}
                    currentUserId={currentUserId}
                    canEdit={allowEdit}
                    canAssign={allowAssign}
                    canManage={allowManage}
                    canDeleteProjects={canDeleteProjects}
                    canDeleteWork={canDeleteWork}
                    canSubmitQa={canSubmitQa}
                    canEditQa={canEditQa}
                    showActions={showActions}
                    compact={compact}
                    panelSelection={panelSelection}
                    onSelectPanel={selectPanel}
                    onUpdatePkg={updatePkg}
                    onUpdateYear={updateYear}
                    onDetail={selectPackage}
                    startTransition={startTransition}
                    forecastSettings={forecastSettings}
                  />
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {panelSelection && (
          <div className={cn(panelSelection.kind === "package" && "hidden xl:block")}>
            <OperationsDetailPanel
            selection={panelSelection}
            onClose={closePanel}
            analysts={analysts}
            comments={comments}
            taskFiles={taskFileUploads}
            timeLogs={timeLogs}
            currentUserId={currentUserId}
            forecastSettings={forecastSettings}
            canAssign={allowAssign}
            canEdit={allowEdit}
            canSubmitQa={canSubmitQa}
            canManage={allowManage}
            resolvePackage={resolvePackage}
          />
          </div>
        )}
        </div>
      </div>
      </div>

      <PackageDetailSheet
        pkg={panelSelection?.kind === "package" ? (resolvePackage(panelSelection.pkg.id) ?? panelSelection.pkg) : null}
        open={panelSelection?.kind === "package"}
        onOpenChange={(o) => !o && closePanel()}
        comments={comments}
        taskFiles={taskFileUploads}
        timeLogs={timeLogs}
        currentUserId={currentUserId}
        analysts={analysts}
        forecastSettings={forecastSettings}
        canAssign={allowAssign}
        canEdit={allowEdit}
        canSubmitQa={canSubmitQa}
        canManage={allowManage}
      />
    </>
  );
}

function ProjectRows({
  node,
  pKey,
  pOpen,
  onToggle,
  expanded,
  onToggleChild,
  selected,
  onToggleSelect,
  analysts,
  currentUserId,
  canEdit,
  canAssign,
  canManage,
  canDeleteProjects,
  canDeleteWork,
  canSubmitQa,
  canEditQa,
  showActions,
  compact,
  panelSelection,
  onSelectPanel,
  onUpdatePkg,
  onUpdateYear,
  onDetail,
  startTransition,
  forecastSettings,
}: {
  node: OperationsTree["projects"][0];
  pKey: string;
  pOpen: boolean;
  onToggle: () => void;
  expanded: Record<string, boolean>;
  onToggleChild: (k: string) => void;
  selected: Set<string>;
  onToggleSelect: (k: string) => void;
  analysts: User[];
  currentUserId: string;
  canEdit: boolean;
  canAssign: boolean;
  canManage: boolean;
  canDeleteProjects: boolean;
  canDeleteWork: boolean;
  canSubmitQa: boolean;
  canEditQa: boolean;
  showActions: boolean;
  compact: boolean;
  panelSelection: OpsPanelSelection | null;
  onSelectPanel: (s: OpsPanelSelection) => void;
  onUpdatePkg: (id: string, u: Partial<WorkPackage>) => void;
  onUpdateYear: (id: string, u: Partial<YearWorkItem>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
  forecastSettings: ForecastSettings;
}) {
  const r = node.rollup;
  const labels = getProjectHierarchyLabels(node.project);
  const owner = analysts.find((a) => a.id === node.project.project_owner_id);
  const due =
    node.project.active_project_due_date ??
    node.project.manual_project_due_date ??
    node.project.due_date;
  const rowSelected = isPanelSelected(panelSelection, pKey);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border hover:bg-emerald-500/10 enterprise-row-hover flow-ops-project-row",
          rowSelected && "flow-ops-row-selected"
        )}
      >
        <td className="py-2.5 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(pKey)} onCheckedChange={() => onToggleSelect(pKey)} />
        </td>
        <td className="py-2.5">
          <div className="flex items-start gap-2 font-semibold min-w-0">
            <button type="button" className="p-0.5 shrink-0 rounded hover:bg-muted/50" onClick={onToggle}>
              {pOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="flex-1 min-w-0 text-left"
              onClick={() => onSelectPanel({ kind: "project", node })}
            >
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{node.project.name}</span>
                <span className="text-[10px] text-muted-foreground font-normal shrink-0">
                  {structureCountSummary(labels, {
                    workstreams: r.manufacturerCount,
                    phases: r.yearCount,
                    tasks: r.totalPackages,
                  })}
                </span>
              </div>
              {compact && (
                <GroupHeaderMetrics rollup={r} dueDate={due} leadName={owner?.full_name} />
              )}
            </button>
          </div>
        </td>
        {compact ? (
          <td colSpan={6} />
        ) : (
          <>
            <td colSpan={4} />
            <RollupCells r={r} />
          </>
        )}
        {showActions && (
          <td>
            <RowActions
              canManage={canManage}
              canDelete={canDeleteProjects}
              onAddManufacturer={
                canManage ? (
                  <AddManufacturerDialog
                    projectId={node.project.id}
                    projectType={node.project.project_type}
                    structureMode={node.project.structure_mode}
                    analysts={analysts}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add {labels.workPackageShort}
                      </DropdownMenuItem>
                    }
                  />
                ) : undefined
              }
              onDelete={
                canDeleteProjects
                  ? () => {
                      if (confirm(`Delete project ${node.project.name}?`)) {
                        startTransition(() => deleteProjectAction(node.project.id));
                      }
                    }
                  : undefined
              }
            />
          </td>
        )}
      </tr>
      {pOpen &&
        node.manufacturers.map((mfrNode) => {
          const mKey = `mfr-${mfrNode.manufacturer.id}`;
          const mOpen = expanded[mKey] ?? false;
          return (
            <ManufacturerRows
              key={mfrNode.manufacturer.id}
              node={mfrNode}
              mKey={mKey}
              mOpen={mOpen}
              onToggle={() => onToggleChild(mKey)}
              expanded={expanded}
              onToggleChild={onToggleChild}
              selected={selected}
              onToggleSelect={onToggleSelect}
              analysts={analysts}
              currentUserId={currentUserId}
              canEdit={canEdit}
              canAssign={canAssign}
              canManage={canManage}
              canDeleteProjects={canDeleteProjects}
              canDeleteWork={canDeleteWork}
              canSubmitQa={canSubmitQa}
              canEditQa={canEditQa}
              showActions={showActions}
              compact={compact}
              panelSelection={panelSelection}
              onSelectPanel={onSelectPanel}
              projectName={node.project.name}
              projectType={node.project.project_type}
              structureMode={node.project.structure_mode}
              onUpdatePkg={onUpdatePkg}
              onUpdateYear={onUpdateYear}
              onDetail={onDetail}
              startTransition={startTransition}
              forecastSettings={forecastSettings}
            />
          );
        })}
    </>
  );
}

function ManufacturerRows({
  node,
  mKey,
  mOpen,
  onToggle,
  expanded,
  onToggleChild,
  selected,
  onToggleSelect,
  analysts,
  currentUserId,
  canEdit,
  canAssign,
  canManage,
  canDeleteProjects,
  canDeleteWork,
  canSubmitQa,
  canEditQa,
  showActions,
  compact,
  panelSelection,
  onSelectPanel,
  projectName,
  projectType,
  structureMode,
  onUpdatePkg,
  onUpdateYear,
  onDetail,
  startTransition,
  forecastSettings,
}: {
  node: OperationsTree["projects"][0]["manufacturers"][0];
  mKey: string;
  mOpen: boolean;
  onToggle: () => void;
  expanded: Record<string, boolean>;
  onToggleChild: (k: string) => void;
  selected: Set<string>;
  onToggleSelect: (k: string) => void;
  analysts: User[];
  currentUserId: string;
  canEdit: boolean;
  canAssign: boolean;
  canManage: boolean;
  canDeleteProjects: boolean;
  canDeleteWork: boolean;
  canSubmitQa: boolean;
  canEditQa: boolean;
  showActions: boolean;
  compact: boolean;
  panelSelection: OpsPanelSelection | null;
  onSelectPanel: (s: OpsPanelSelection) => void;
  projectName: string;
  projectType?: string | null;
  structureMode?: string | null;
  onUpdatePkg: (id: string, u: Partial<WorkPackage>) => void;
  onUpdateYear: (id: string, u: Partial<YearWorkItem>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
  forecastSettings: ForecastSettings;
}) {
  const mr = node.rollup;
  const mfr = node.manufacturer;
  const labels = getProgramLabels(projectType, structureMode);
  const rowSelected = isPanelSelected(panelSelection, mKey);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border hover:bg-accent enterprise-row-hover",
          rowSelected && "flow-ops-row-selected"
        )}
      >
        <td className="py-2 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(mKey)} onCheckedChange={() => onToggleSelect(mKey)} />
        </td>
        <td className="py-2 pl-4">
          <div className="flex items-start gap-2 font-medium min-w-0">
            <button type="button" className="p-0.5 shrink-0" onClick={onToggle}>
              {mOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              className="flex-1 min-w-0 text-left"
              onClick={() =>
                onSelectPanel({ kind: "manufacturer", node, projectName, projectType, structureMode })
              }
            >
              <div className="flex items-center gap-2">
                <Factory className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                {mfr.name}
                <span className="text-[10px] text-muted-foreground font-normal">
                  {mr.yearCount} {labels.phasePlural.toLowerCase()} · {mr.completedPct}% done
                </span>
              </div>
              {compact && <GroupHeaderMetrics rollup={mr} />}
            </button>
          </div>
        </td>
        {compact ? (
          <td colSpan={6} />
        ) : (
          <>
            <td colSpan={4} />
            <RollupCells r={mr} compact />
          </>
        )}
        {showActions && (
          <td>
            <RowActions
              canManage={canManage}
              canDelete={canDeleteProjects}
              onAddYear={
                canManage ? (
                  <AddYearDialog
                    projectId={mfr.project_id}
                    projectType={projectType}
                    structureMode={structureMode}
                    manufacturerId={mfr.id}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Calendar className="h-3.5 w-3.5 mr-2" /> Add {labels.phaseShort}
                      </DropdownMenuItem>
                    }
                  />
                ) : undefined
              }
              onBulkYears={
                canManage ? (
                  <BulkYearsDialog
                    mfr={mfr}
                    projectType={projectType}
                    structureMode={structureMode}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Calendar className="h-3.5 w-3.5 mr-2" /> Bulk {labels.phasePlural}
                      </DropdownMenuItem>
                    }
                  />
                ) : undefined
              }
              onArchive={
                canManage
                  ? () => startTransition(() => archiveManufacturerAction(mfr.id))
                  : undefined
              }
              onDelete={
                canDeleteProjects
                  ? () => {
                      if (confirm(`Delete ${mfr.name}?`)) {
                        startTransition(() => deleteManufacturerAction(mfr.id));
                      }
                    }
                  : undefined
              }
            />
          </td>
        )}
      </tr>
      {mOpen &&
        node.years.map((yearNode) => {
          const yKey = `yr-${yearNode.yearWorkItem.id}`;
          const yOpen = expanded[yKey] ?? true;
          return (
            <YearRowsGroup
              key={yKey}
              yKey={yKey}
              yearNode={yearNode}
              manufacturerName={mfr.name}
              projectName={projectName}
              projectType={projectType}
              structureMode={structureMode}
              yOpen={yOpen}
              onToggleChild={onToggleChild}
              selected={selected}
              onToggleSelect={onToggleSelect}
              analysts={analysts}
              currentUserId={currentUserId}
              canEdit={canEdit}
              canAssign={canAssign}
              canManage={canManage}
              canDeleteProjects={canDeleteProjects}
              canDeleteWork={canDeleteWork}
              canSubmitQa={canSubmitQa}
              canEditQa={canEditQa}
              showActions={showActions}
              compact={compact}
              panelSelection={panelSelection}
              onSelectPanel={onSelectPanel}
              onUpdatePkg={onUpdatePkg}
              onUpdateYear={onUpdateYear}
              onDetail={onDetail}
              startTransition={startTransition}
              forecastSettings={forecastSettings}
            />
          );
        })}
    </>
  );
}

function YearRowsGroup({
  yKey,
  yearNode,
  manufacturerName,
  projectName,
  projectType,
  structureMode,
  yOpen,
  onToggleChild,
  selected,
  onToggleSelect,
  analysts,
  currentUserId,
  canEdit,
  canAssign,
  canManage,
  canDeleteProjects,
  canDeleteWork,
  canSubmitQa,
  canEditQa,
  showActions,
  compact,
  panelSelection,
  onSelectPanel,
  onUpdatePkg,
  onUpdateYear,
  onDetail,
  startTransition,
  forecastSettings,
}: {
  yKey: string;
  yearNode: OperationsTree["projects"][0]["manufacturers"][0]["years"][0];
  manufacturerName: string;
  projectName: string;
  projectType?: string | null;
  structureMode?: string | null;
  yOpen: boolean;
  onToggleChild: (k: string) => void;
  selected: Set<string>;
  onToggleSelect: (k: string) => void;
  analysts: User[];
  currentUserId: string;
  canEdit: boolean;
  canAssign: boolean;
  canManage: boolean;
  canDeleteProjects: boolean;
  canDeleteWork: boolean;
  canSubmitQa: boolean;
  canEditQa: boolean;
  showActions: boolean;
  compact: boolean;
  panelSelection: OpsPanelSelection | null;
  onSelectPanel: (s: OpsPanelSelection) => void;
  onUpdatePkg: (id: string, u: Partial<WorkPackage>) => void;
  onUpdateYear: (id: string, u: Partial<YearWorkItem>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
  forecastSettings: ForecastSettings;
}) {
  const y = yearNode.yearWorkItem;
  const yr = yearNode.rollup;
  const labels = getProgramLabels(projectType, structureMode);
  const rowSelected = isPanelSelected(panelSelection, yKey);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/20 hover:bg-muted/10",
          isYearOverdue(y) && "bg-red-500/5",
          rowSelected && "flow-ops-row-selected"
        )}
      >
        <td className="py-1.5 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(yKey)} onCheckedChange={() => onToggleSelect(yKey)} />
        </td>
        <td className="py-1.5 pl-10">
          <div className="flex items-center gap-2">
            <button type="button" className="p-0.5 shrink-0" onClick={() => onToggleChild(yKey)}>
              {yOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 text-left"
              onClick={() =>
                onSelectPanel({
                  kind: "year",
                  node: yearNode,
                  manufacturerName,
                  projectName,
                  projectType,
                  structureMode,
                })
              }
            >
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{y.year}</span>
              <span className="text-[10px] text-muted-foreground">({yr.totalPackages} tasks)</span>
            </button>
          </div>
        </td>
        <InlineStatus value={y.status} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { status: v })} />
        <InlineAnalyst value={y.assigned_to} analysts={analysts} canEdit={canAssign} onChange={(v) => onUpdateYear(y.id, { assigned_to: v })} />
        <InlinePriority value={y.priority} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { priority: v })} />
        <InlineDate value={y.due_date} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { due_date: v })} overdue={isYearOverdue(y)} />
        {!compact && (
          <>
            <InlineHours value={y.estimated_hours} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { estimated_hours: v })} />
            <td className="text-right text-xs tabular-nums text-muted-foreground">{y.actual_hours}</td>
            <td className="text-right text-xs tabular-nums">{y.file_count}</td>
          </>
        )}
        <td className="text-right text-xs tabular-nums">{yr.completedPct}%</td>
        <td className="text-xs text-muted-foreground">{compact ? `${yr.qaPassRate}%` : `${yr.qaPassRate}% pass`}</td>
        {!compact && (
          <>
            <td className="text-right text-xs">{yr.correctionCount}</td>
            <td className="text-right text-xs text-muted-foreground whitespace-nowrap">
              {formatLastActivity(yr.lastActivityAt)}
            </td>
          </>
        )}
        {showActions && (
          <td>
            <RowActions
              canManage={canManage}
              canDelete={canDeleteProjects}
              onAddPackage={
                canManage ? (
                  <AddWorkPackageDialog
                    yearItem={y}
                    manufacturerName={manufacturerName}
                    analysts={analysts}
                    forecastSettings={forecastSettings}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add {labels.task}
                      </DropdownMenuItem>
                    }
                  />
                ) : undefined
              }
              onNotes={
                canEdit ? (
                  <InlineNotesDialog
                    value={y.notes}
                    onSave={(notes) => onUpdateYear(y.id, { notes })}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <MessageSquare className="h-3.5 w-3.5 mr-2" /> Notes
                      </DropdownMenuItem>
                    }
                  />
                ) : undefined
              }
              onDelete={canDeleteProjects ? () => startTransition(() => deleteYearAction(y.id)) : undefined}
            />
          </td>
        )}
      </tr>
      {yOpen &&
        yearNode.packages.map((pkg) => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            analysts={analysts}
            currentUserId={currentUserId}
            selected={selected.has(`pkg-${pkg.id}`)}
            rowSelected={isPanelSelected(panelSelection, `pkg-${pkg.id}`)}
            onToggleSelect={() => onToggleSelect(`pkg-${pkg.id}`)}
            canEdit={canEdit}
            canAssign={canAssign}
            canManage={canManage}
            canDeleteWork={canDeleteWork}
            canSubmitQa={canSubmitQa}
            canEditQa={canEditQa}
            showActions={showActions}
            compact={compact}
            onUpdate={onUpdatePkg}
            onDetail={onDetail}
            startTransition={startTransition}
          />
        ))}
    </>
  );
}

function PackageRow({
  pkg,
  analysts,
  currentUserId,
  selected,
  rowSelected,
  onToggleSelect,
  canEdit,
  canAssign,
  canManage,
  canDeleteWork,
  canSubmitQa,
  canEditQa,
  showActions,
  compact,
  onUpdate,
  onDetail,
  startTransition,
}: {
  pkg: WorkPackage;
  analysts: User[];
  currentUserId: string;
  selected: boolean;
  rowSelected: boolean;
  onToggleSelect: () => void;
  canEdit: boolean;
  canAssign: boolean;
  canManage: boolean;
  canDeleteWork: boolean;
  canSubmitQa: boolean;
  canEditQa: boolean;
  showActions: boolean;
  compact: boolean;
  onUpdate: (id: string, u: Partial<WorkPackage>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  const overdue = isOverdue(pkg);
  const stuck = isStuck(pkg);

  return (
    <tr
      className={cn(
        "border-b border-border hover:bg-accent group enterprise-row-hover",
        overdue && "bg-red-500/5",
        stuck && "bg-amber-500/5",
        rowSelected && "flow-ops-row-selected"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <td className="py-2 pl-3">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </td>
      <td className={cn("py-2", compact ? "pl-12" : "pl-16")}>
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
          <button
            type="button"
            className="truncate text-left text-[13px] font-medium text-foreground hover:text-foreground/80 hover:underline"
            onClick={() => onDetail(pkg)}
          >
            {pkg.title}
          </button>
          {overdue && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
          {stuck && <span className="text-[9px] font-bold text-amber-400 uppercase">Stuck</span>}
        </div>
      </td>
      <InlineStatus value={pkg.status} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { status: v })} />
      <InlineAnalyst
        value={pkg.assigned_to}
        analysts={analysts}
        canEdit={canAssign}
        onChange={(v) => onUpdate(pkg.id, { assigned_to: v })}
      />
      <InlinePriority value={pkg.priority} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { priority: v })} />
      <InlineDate value={pkg.due_date} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { due_date: v })} overdue={overdue} />
      {!compact && (
        <>
          <InlineHours value={pkg.estimated_hours} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { estimated_hours: v })} />
          <td className="text-right text-xs tabular-nums text-muted-foreground">{pkg.actual_hours}</td>
          <td className="text-right text-xs tabular-nums">{pkg.file_count}</td>
        </>
      )}
      <td className="text-right text-xs tabular-nums">{pkgDonePct(pkg)}%</td>
      <InlineQaStatus
        value={pkg.qa_status}
        canEdit={canEditQa || canManage}
        onChange={(v) => onUpdate(pkg.id, { qa_status: v })}
      />
      {!compact && (
        <>
          <td className="text-right text-xs">{pkg.correction_count}</td>
          <td className="text-right text-xs text-muted-foreground whitespace-nowrap">
            {formatLastActivity(pkg.updated_at)}
          </td>
        </>
      )}
      {showActions && (
        <td>
          <RowActions
            onDetail={() => onDetail(pkg)}
            onLogTime={canEdit ? () => onDetail(pkg) : undefined}
            onComment={canEdit ? () => onDetail(pkg) : undefined}
            onUpload={canEdit ? () => onDetail(pkg) : undefined}
            onSubmitQa={
              canSubmitQa && pkg.status !== "done" && !["ready_for_qa", "in_qa"].includes(pkg.status)
                ? () => startTransition(() => submitWorkPackageToQaAction(pkg.id))
                : undefined
            }
            onComplete={
              canEdit && pkg.status !== "done"
                ? () => startTransition(() => completeWorkPackageAction(pkg.id))
                : undefined
            }
            onDuplicate={
              canManage
                ? () => startTransition(async () => { await duplicateWorkPackageAction(pkg.id); })
                : undefined
            }
            onDelete={
              canDeleteWork
                ? () => {
                    if (confirm(`Delete ${pkg.title}?`)) {
                      startTransition(() => deleteWorkPackageAction(pkg.id));
                    }
                  }
                : undefined
            }
            onNotes={
              canEdit ? (
                <InlineNotesDialog
                  value={pkg.notes}
                  onSave={(notes) => onUpdate(pkg.id, { notes })}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <MessageSquare className="h-3.5 w-3.5 mr-2" /> Notes
                    </DropdownMenuItem>
                  }
                />
              ) : undefined
            }
          />
        </td>
      )}
    </tr>
  );
}

function RowActions({
  onAddManufacturer,
  onAddYear,
  onBulkYears,
  onAddPackage,
  onDetail,
  onLogTime,
  onComment,
  onUpload,
  onSubmitQa,
  onComplete,
  onDuplicate,
  onArchive,
  onDelete,
  onNotes,
  canManage,
  canDelete,
}: {
  onAddManufacturer?: React.ReactNode;
  onAddYear?: React.ReactNode;
  onBulkYears?: React.ReactNode;
  onAddPackage?: React.ReactNode;
  onDetail?: () => void;
  onLogTime?: () => void;
  onComment?: () => void;
  onUpload?: () => void;
  onSubmitQa?: () => void;
  onComplete?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onNotes?: React.ReactNode;
  canManage?: boolean;
  canDelete?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100" />
        }
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onAddManufacturer}
        {onAddYear}
        {onBulkYears}
        {onAddPackage}
        {onDetail && (
          <DropdownMenuItem onClick={onDetail}>
            <MessageSquare className="h-3.5 w-3.5 mr-2" /> Open details
          </DropdownMenuItem>
        )}
        {onLogTime && (
          <DropdownMenuItem onClick={onLogTime}>
            <Calendar className="h-3.5 w-3.5 mr-2" /> Log time
          </DropdownMenuItem>
        )}
        {onComment && (
          <DropdownMenuItem onClick={onComment}>
            <MessageSquare className="h-3.5 w-3.5 mr-2" /> Add comment
          </DropdownMenuItem>
        )}
        {onUpload && (
          <DropdownMenuItem onClick={onUpload}>
            <Upload className="h-3.5 w-3.5 mr-2" /> Upload file
          </DropdownMenuItem>
        )}
        {onNotes}
        {onSubmitQa && (
          <DropdownMenuItem onClick={onSubmitQa}>Submit to QA</DropdownMenuItem>
        )}
        {onComplete && (
          <DropdownMenuItem onClick={onComplete}>Mark complete</DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
          </DropdownMenuItem>
        )}
        {(onArchive || onDelete) && <DropdownMenuSeparator />}
        {onArchive && (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="h-3.5 w-3.5 mr-2" /> Archive
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineNotesDialog({
  value,
  onSave,
  trigger,
}: {
  value?: string | null;
  onSave: (notes: string | null) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setText(value ?? "");
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Notes…"
          rows={4}
          className="text-xs"
        />
        <DialogFooter>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              onSave(text || null);
              setOpen(false);
            }}
          >
            Save notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineStatus({ value, canEdit, onChange }: { value: WorkStatus; canEdit: boolean; onChange: (v: WorkStatus) => void }) {
  if (!canEdit) return <td><StatusBadge status={value} size="sm" /></td>;
  return (
    <td onClick={(e) => e.stopPropagation()}>
      <Select value={value} onValueChange={(v) => v && onChange(v as WorkStatus)}>
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent>
          {WORK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </td>
  );
}

function InlineAnalyst({ value, analysts, canEdit, onChange }: { value?: string | null; analysts: User[]; canEdit: boolean; onChange: (v: string | null) => void }) {
  if (!canEdit) return <td className="text-xs">{analysts.find((a) => a.id === value)?.full_name ?? "—"}</td>;
  return (
    <td onClick={(e) => e.stopPropagation()}>
      <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v && v !== "__none__" ? v : null)}>
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent max-w-[110px]">
          <EntitySelectValue
            value={value ?? "__none__"}
            items={analysts}
            getLabel={userDisplayName}
            placeholder="—"
            sentinels={[{ value: "__none__", label: "—" }]}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {analysts.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </td>
  );
}

function InlineDate({ value, canEdit, onChange, overdue }: { value?: string | null; canEdit: boolean; onChange: (v: string | null) => void; overdue?: boolean }) {
  if (!canEdit) return <td className={cn("text-xs tabular-nums", overdue && "text-red-400")}>{value ?? "—"}</td>;
  return (
    <td onClick={(e) => e.stopPropagation()}>
      <Input
        type="date"
        className={cn("h-7 text-xs border-0 bg-transparent w-[108px]", overdue && "text-red-400")}
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(e.target.value || null)}
      />
    </td>
  );
}

function InlinePriority({ value, canEdit, onChange }: { value: WorkPriority; canEdit: boolean; onChange: (v: WorkPriority) => void }) {
  if (!canEdit) return <td><PriorityBadge priority={value} /></td>;
  return (
    <td onClick={(e) => e.stopPropagation()}>
      <Select value={value} onValueChange={(v) => v && onChange(v as WorkPriority)}>
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
        <SelectContent>
          {WORK_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </td>
  );
}

function InlineHours({ value, canEdit, onChange }: { value: number; canEdit: boolean; onChange: (v: number) => void }) {
  if (!canEdit) return <td className="text-right text-xs tabular-nums text-muted-foreground">{value}</td>;
  return (
    <td className="text-right" onClick={(e) => e.stopPropagation()}>
      <Input
        type="number"
        min={0}
        step={0.5}
        className="h-7 text-xs border-0 bg-transparent w-14 text-right ml-auto"
        defaultValue={value}
        onBlur={(e) => onChange(Number(e.target.value) || 0)}
      />
    </td>
  );
}

function InlineQaStatus({ value, canEdit, onChange }: { value: QaStatus; canEdit: boolean; onChange: (v: QaStatus) => void }) {
  if (!canEdit) return <td className="text-xs text-muted-foreground">{qaStatusLabel(value)}</td>;
  return (
    <td onClick={(e) => e.stopPropagation()}>
      <Select value={value} onValueChange={(v) => v && onChange(v as QaStatus)}>
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
        <SelectContent>
          {QA_STATUSES.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </td>
  );
}
