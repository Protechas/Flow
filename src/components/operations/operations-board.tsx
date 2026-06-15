"use client";

import { useMemo, useState, useTransition } from "react";
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
import { PackageDetailSheet } from "@/components/operations/package-detail-sheet";
import { formatLastActivity, RollupCells } from "@/components/operations/rollup-cells";
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
  FlowFile,
  OperationsTree,
  QaStatus,
  TimeLog,
  User,
  WorkPackage,
  WorkPriority,
  WorkStatus,
  YearWorkItem,
} from "@/types/flow";
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
  UserPlus,
} from "lucide-react";

interface OperationsBoardProps {
  tree: OperationsTree;
  analysts: User[];
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
  files: FlowFile[];
  timeLogs: TimeLog[];
}

const COL_COUNT = 14;

function isYearOverdue(y: YearWorkItem) {
  if (!y.due_date || y.status === "done") return false;
  return isBefore(parseISO(y.due_date), startOfDay(new Date()));
}

function pkgDonePct(pkg: WorkPackage) {
  return pkg.status === "done" ? 100 : 0;
}

export function OperationsBoard({
  tree,
  analysts,
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
  files,
  timeLogs,
}: OperationsBoardProps) {
  const allowEdit = canEdit && !readOnly;
  const allowAssign = canAssign && !readOnly;
  const allowManage = canManageProjects && !readOnly;
  const showActions = allowEdit || allowAssign || canDeleteProjects || canDeleteWork || allowManage;

  const [filters, setFilters] = useState<OpsBoardFilters>(DEFAULT_OPS_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [detailPkg, setDetailPkg] = useState<WorkPackage | null>(null);

  const projectIds = useMemo(() => tree.projects.map((p) => p.project.id), [tree]);
  const { expanded, toggle, expandAll, collapseAll } = useOperationsExpanded(projectIds);

  const filteredTree = useMemo(
    () => filterOperationsTree(tree, filters, teamUserIds),
    [tree, filters, teamUserIds]
  );

  const projects = useMemo(() => flattenProjects(tree), [tree]);
  const manufacturers = useMemo(() => flattenManufacturers(tree), [tree]);

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedPkgIds = useMemo(
    () => collectPackageIds(filteredTree, selected),
    [filteredTree, selected]
  );

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
      <OperationsToolbar
        filters={filters}
        onFiltersChange={setFilters}
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
                if (confirm(`Delete ${selectedPkgIds.length} work packages?`)) {
                  runBulk(() => bulkDeleteWorkPackagesAction(selectedPkgIds));
                }
              }
            : undefined
        }
      />

      <div className="enterprise-panel overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-11rem)]">
          <table className="w-full min-w-[1400px] text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 enterprise-grid-header">
              <tr className="text-xs text-muted-foreground">
                <th className="w-8 py-2.5 pl-3 bg-secondary"> </th>
                <th className="text-left font-semibold py-2.5 w-[300px] bg-secondary">Name</th>
                <th className="text-left font-semibold py-2.5 w-[120px] bg-secondary">Status</th>
                <th className="text-left font-semibold py-2.5 w-[118px] bg-secondary">Assigned To</th>
                <th className="text-left font-semibold py-2.5 w-[90px] bg-secondary">Priority</th>
                <th className="text-left font-semibold py-2.5 w-[100px] bg-secondary">Due Date</th>
                <th className="text-right font-semibold py-2.5 w-[64px] bg-secondary">Est Hrs</th>
                <th className="text-right font-semibold py-2.5 w-[64px] bg-secondary">Act Hrs</th>
                <th className="text-right font-semibold py-2.5 w-[48px] bg-secondary">Files</th>
                <th className="text-left font-semibold py-2.5 w-[80px] bg-secondary">QA Status</th>
                <th className="text-right font-semibold py-2.5 w-[44px] bg-secondary">Corr</th>
                <th className="text-right font-semibold py-2.5 w-[52px] bg-secondary">Done%</th>
                <th className="text-right font-semibold py-2.5 w-[100px] bg-secondary">Last Activity</th>
                {showActions && <th className="w-10 py-2.5 bg-secondary" />}
              </tr>
            </thead>
            <tbody className={cn(pending && "opacity-60 pointer-events-none")}>
              {filteredTree.projects.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="py-12 text-center text-muted-foreground text-sm">
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
                    onUpdatePkg={updatePkg}
                    onUpdateYear={updateYear}
                    onDetail={setDetailPkg}
                    startTransition={startTransition}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PackageDetailSheet
        pkg={detailPkg}
        open={!!detailPkg}
        onOpenChange={(o) => !o && setDetailPkg(null)}
        comments={comments}
        files={files}
        timeLogs={timeLogs}
        currentUserId={currentUserId}
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
  onUpdatePkg,
  onUpdateYear,
  onDetail,
  startTransition,
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
  onUpdatePkg: (id: string, u: Partial<WorkPackage>) => void;
  onUpdateYear: (id: string, u: Partial<YearWorkItem>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  const r = node.rollup;
  return (
    <>
      <tr className="border-b border-border bg-blue-500/10 hover:bg-blue-500/15 enterprise-row-hover">
        <td className="py-2.5 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(pKey)} onCheckedChange={() => onToggleSelect(pKey)} />
        </td>
        <td className="py-2.5 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2 font-semibold">
            {pOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <FolderKanban className="h-4 w-4 text-violet-400" />
            {node.project.name}
            <span className="text-[10px] text-muted-foreground font-normal">
              {r.manufacturerCount} mfr · {r.yearCount} yr · {r.totalPackages} pkg
            </span>
          </div>
        </td>
        <td colSpan={4} />
        <RollupCells r={r} />
        {showActions && (
          <td>
            <RowActions
              canManage={canManage}
              canDelete={canDeleteProjects}
              onAddManufacturer={
                canManage ? (
                  <AddManufacturerDialog
                    projectId={node.project.id}
                    analysts={analysts}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add Manufacturer
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
              onUpdatePkg={onUpdatePkg}
              onUpdateYear={onUpdateYear}
              onDetail={onDetail}
              startTransition={startTransition}
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
  onUpdatePkg,
  onUpdateYear,
  onDetail,
  startTransition,
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
  onUpdatePkg: (id: string, u: Partial<WorkPackage>) => void;
  onUpdateYear: (id: string, u: Partial<YearWorkItem>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  const mr = node.rollup;
  const mfr = node.manufacturer;
  return (
    <>
      <tr className="border-b border-border hover:bg-accent enterprise-row-hover">
        <td className="py-2 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(mKey)} onCheckedChange={() => onToggleSelect(mKey)} />
        </td>
        <td className="py-2 pl-4 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2 font-medium">
            {mOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Factory className="h-3.5 w-3.5 text-indigo-400" />
            {mfr.name}
            <span className="text-[10px] text-muted-foreground font-normal">
              {mr.yearCount} yr · {mr.completedPct}% done
            </span>
          </div>
        </td>
        <td colSpan={4} />
        <RollupCells r={mr} compact />
        {showActions && (
          <td>
            <RowActions
              canManage={canManage}
              canDelete={canDeleteProjects}
              onAddYear={
                canManage ? (
                  <AddYearDialog
                    projectId={mfr.project_id}
                    manufacturerId={mfr.id}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Calendar className="h-3.5 w-3.5 mr-2" /> Add Year
                      </DropdownMenuItem>
                    }
                  />
                ) : undefined
              }
              onBulkYears={
                canManage ? (
                  <BulkYearsDialog
                    mfr={mfr}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Calendar className="h-3.5 w-3.5 mr-2" /> Bulk Create Years
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
              onUpdatePkg={onUpdatePkg}
              onUpdateYear={onUpdateYear}
              onDetail={onDetail}
              startTransition={startTransition}
            />
          );
        })}
    </>
  );
}

function YearRowsGroup({
  yKey,
  yearNode,
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
  onUpdatePkg,
  onUpdateYear,
  onDetail,
  startTransition,
}: {
  yKey: string;
  yearNode: OperationsTree["projects"][0]["manufacturers"][0]["years"][0];
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
  onUpdatePkg: (id: string, u: Partial<WorkPackage>) => void;
  onUpdateYear: (id: string, u: Partial<YearWorkItem>) => void;
  onDetail: (p: WorkPackage) => void;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  const y = yearNode.yearWorkItem;
  const yr = yearNode.rollup;
  return (
    <>
      <tr
        className={cn("border-b border-border/20 hover:bg-muted/10", isYearOverdue(y) && "bg-red-500/5")}
      >
        <td className="py-1.5 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(yKey)} onCheckedChange={() => onToggleSelect(yKey)} />
        </td>
        <td className="py-1.5 pl-10 cursor-pointer" onClick={() => onToggleChild(yKey)}>
          <div className="flex items-center gap-2">
            {yOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{y.year}</span>
            <span className="text-[10px] text-muted-foreground">({yr.totalPackages} tasks)</span>
          </div>
        </td>
        <InlineStatus value={y.status} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { status: v })} />
        <InlineAnalyst value={y.assigned_to} analysts={analysts} canEdit={canAssign} onChange={(v) => onUpdateYear(y.id, { assigned_to: v })} />
        <InlinePriority value={y.priority} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { priority: v })} />
        <InlineDate value={y.due_date} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { due_date: v })} overdue={isYearOverdue(y)} />
        <InlineHours value={y.estimated_hours} canEdit={canEdit && canManage} onChange={(v) => onUpdateYear(y.id, { estimated_hours: v })} />
        <td className="text-right text-xs tabular-nums text-muted-foreground">{y.actual_hours}</td>
        <td className="text-right text-xs tabular-nums">{y.file_count}</td>
        <td className="text-xs text-muted-foreground">{yr.qaPassRate}% pass</td>
        <td className="text-right text-xs">{yr.correctionCount}</td>
        <td className="text-right text-xs">{yr.completedPct}%</td>
        <td className="text-right text-xs text-muted-foreground whitespace-nowrap">
          {formatLastActivity(yr.lastActivityAt)}
        </td>
        {showActions && (
          <td>
            <RowActions
              canManage={canManage}
              canDelete={canDeleteProjects}
              onAddPackage={
                canManage ? (
                  <AddWorkPackageDialog
                    yearItem={y}
                    analysts={analysts}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add Work Package
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
            onToggleSelect={() => onToggleSelect(`pkg-${pkg.id}`)}
            canEdit={canEdit}
            canAssign={canAssign}
            canManage={canManage}
            canDeleteWork={canDeleteWork}
            canSubmitQa={canSubmitQa}
            canEditQa={canEditQa}
            showActions={showActions}
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
  onToggleSelect,
  canEdit,
  canAssign,
  canManage,
  canDeleteWork,
  canSubmitQa,
  canEditQa,
  showActions,
  onUpdate,
  onDetail,
  startTransition,
}: {
  pkg: WorkPackage;
  analysts: User[];
  currentUserId: string;
  selected: boolean;
  onToggleSelect: () => void;
  canEdit: boolean;
  canAssign: boolean;
  canManage: boolean;
  canDeleteWork: boolean;
  canSubmitQa: boolean;
  canEditQa: boolean;
  showActions: boolean;
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
        stuck && "bg-amber-500/5"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <td className="py-2.5 pl-3">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </td>
      <td className="py-2.5 pl-16">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
          <button
            type="button"
            className="truncate text-left text-[13px] font-medium text-foreground hover:text-primary hover:underline"
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
        onChange={(v) =>
          onUpdate(pkg.id, {
            assigned_to: v,
            status: v && pkg.status === "not_started" ? "assigned" : pkg.status,
          })
        }
      />
      <InlinePriority value={pkg.priority} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { priority: v })} />
      <InlineDate value={pkg.due_date} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { due_date: v })} overdue={overdue} />
      <InlineHours value={pkg.estimated_hours} canEdit={canEdit} onChange={(v) => onUpdate(pkg.id, { estimated_hours: v })} />
      <td className="text-right text-xs tabular-nums text-muted-foreground">{pkg.actual_hours}</td>
      <td className="text-right text-xs tabular-nums">{pkg.file_count}</td>
      <InlineQaStatus
        value={pkg.qa_status}
        canEdit={canEditQa || canManage}
        onChange={(v) => onUpdate(pkg.id, { qa_status: v })}
      />
      <td className="text-right text-xs">{pkg.correction_count}</td>
      <td className="text-right text-xs">{pkgDonePct(pkg)}%</td>
      <td className="text-right text-xs text-muted-foreground whitespace-nowrap">
        {formatLastActivity(pkg.updated_at)}
      </td>
      {showActions && (
        <td>
          <RowActions
            onDetail={() => onDetail(pkg)}
            onAssign={
              canAssign
                ? () => {
                    /* opens detail for assign via sheet */
                    onDetail(pkg);
                  }
                : undefined
            }
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
  onAssign,
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
  onAssign?: () => void;
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
        {onAssign && (
          <DropdownMenuItem onClick={onAssign}>
            <UserPlus className="h-3.5 w-3.5 mr-2" /> Assign user
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
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent max-w-[110px]"><SelectValue /></SelectTrigger>
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
