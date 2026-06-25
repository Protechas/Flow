"use client";

import { useRouter } from "next/navigation";
import { PackageDetailContent } from "@/components/operations/package-detail-content";
import { AddManufacturerDialog } from "@/components/operations/operations-dialogs";
import { AddWorkPackageDialog } from "@/components/projects/add-work-package-dialog";
import { formatLastActivity } from "@/components/operations/rollup-cells";
import { getProgramLabels, getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { structureCountSummary } from "@/lib/projects/hierarchy-display";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  ForecastSettings,
  OperationsTree,
  User,
  WorkPackage,
} from "@/types/flow";
import {
  Calendar,
  Factory,
  FolderKanban,
  Package,
  Plus,
  X,
} from "lucide-react";

export type OpsPanelSelection =
  | { kind: "project"; node: OperationsTree["projects"][0] }
  | { kind: "manufacturer"; node: OperationsTree["projects"][0]["manufacturers"][0]; projectName: string; projectType?: string | null; structureMode?: string | null }
  | {
      kind: "year";
      node: OperationsTree["projects"][0]["manufacturers"][0]["years"][0];
      manufacturerName: string;
      projectName: string;
      projectType?: string | null;
      structureMode?: string | null;
    }
  | { kind: "package"; pkg: WorkPackage };

export function OperationsDetailPanel({
  selection,
  onClose,
  analysts,
  comments,
  taskFiles,
  timeLogs,
  currentUserId,
  forecastSettings,
  canAssign,
  canEdit,
  canSubmitQa,
  canManage,
  resolvePackage,
}: {
  selection: OpsPanelSelection;
  onClose: () => void;
  analysts: User[];
  comments: Parameters<typeof PackageDetailContent>[0]["comments"];
  taskFiles: Parameters<typeof PackageDetailContent>[0]["taskFiles"];
  timeLogs: Parameters<typeof PackageDetailContent>[0]["timeLogs"];
  currentUserId: string;
  forecastSettings: ForecastSettings;
  canAssign: boolean;
  canEdit: boolean;
  canSubmitQa: boolean;
  canManage: boolean;
  resolvePackage: (id: string) => WorkPackage | undefined;
}) {
  const router = useRouter();

  const refresh = () => router.refresh();

  const header = (() => {
    switch (selection.kind) {
      case "project": {
        const labels = getProjectHierarchyLabels(selection.node.project);
        const r = selection.node.rollup;
        return {
          icon: FolderKanban,
          title: selection.node.project.name,
          subtitle: structureCountSummary(labels, {
            workstreams: r.manufacturerCount,
            phases: r.yearCount,
            tasks: r.totalPackages,
          }),
        };
      }
      case "manufacturer": {
        const labels = getProgramLabels(selection.projectType, selection.structureMode);
        return {
          icon: Factory,
          title: selection.node.manufacturer.name,
          subtitle: `${selection.projectName} · ${selection.node.rollup.yearCount} ${labels.phasePlural.toLowerCase()}`,
        };
      }
      case "year": {
        return {
          icon: Calendar,
          title: String(selection.node.yearWorkItem.year),
          subtitle: `${selection.projectName} · ${selection.manufacturerName}`,
        };
      }
      case "package": {
        const pkg = resolvePackage(selection.pkg.id) ?? selection.pkg;
        return {
          icon: Package,
          title: pkg.title,
          subtitle: `${pkg.manufacturer?.name ?? "—"} · ${pkg.year}`,
        };
      }
    }
  })();

  const Icon = header.icon;

  return (
    <aside className="flow-ops-detail-panel flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-2 p-4 border-b border-border/50 shrink-0">
        <div className="min-w-0 flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm leading-tight truncate">{header.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{header.subtitle}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selection.kind === "project" && (
          <ProjectPanelBody
            node={selection.node}
            analysts={analysts}
            canManage={canManage}
            onRefresh={refresh}
          />
        )}
        {selection.kind === "manufacturer" && (
          <ManufacturerPanelBody
            node={selection.node}
            projectName={selection.projectName}
            projectType={selection.projectType}
            structureMode={selection.structureMode}
          />
        )}
        {selection.kind === "year" && (
          <YearPanelBody
            node={selection.node}
            manufacturerName={selection.manufacturerName}
            projectType={selection.projectType}
            structureMode={selection.structureMode}
            analysts={analysts}
            forecastSettings={forecastSettings}
            canManage={canManage}
            onRefresh={refresh}
          />
        )}
        {selection.kind === "package" && (
          <PackageDetailContent
            pkg={resolvePackage(selection.pkg.id) ?? selection.pkg}
            comments={comments}
            taskFiles={taskFiles}
            timeLogs={timeLogs}
            currentUserId={currentUserId}
            analysts={analysts}
            actions={{ canAssign, canEdit, canSubmitQa, canManage }}
            onUpdated={refresh}
          />
        )}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function ProjectPanelBody({
  node,
  analysts,
  canManage,
  onRefresh,
}: {
  node: OperationsTree["projects"][0];
  analysts: User[];
  canManage: boolean;
  onRefresh: () => void;
}) {
  const p = node.project;
  const r = node.rollup;
  const labels = getProjectHierarchyLabels(p);
  const owner = analysts.find((a) => a.id === p.project_owner_id);
  const due = p.active_project_due_date ?? p.manual_project_due_date ?? p.due_date;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium tabular-nums">{r.completedPct}%</span>
        </div>
        <Progress value={r.completedPct} className="h-2" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Est hours" value={`${r.estimatedHours}h`} />
        <Metric label="Actual hours" value={`${r.hoursLogged}h`} />
        <Metric label="Files" value={r.fileCount} />
        <Metric label="QA pass" value={`${r.qaPassRate}%`} />
        <Metric label="Overdue" value={r.overdueCount} />
        <Metric label="Stuck" value={r.stuckCount} />
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Due date</dt>
          <dd className="tabular-nums">{due ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Team / lead</dt>
          <dd>{owner?.full_name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Ready for QA</dt>
          <dd className="tabular-nums">{r.readyForQa}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Last activity</dt>
          <dd className="text-muted-foreground">{formatLastActivity(r.lastActivityAt)}</dd>
        </div>
      </dl>

      {p.project_due_date_status && (
        <p className="text-xs text-muted-foreground">
          Due date status: <span className="text-foreground capitalize">{p.project_due_date_status.replace(/_/g, " ")}</span>
        </p>
      )}

      {canManage && (
        <AddManufacturerDialog
          projectId={p.id}
          projectType={p.project_type}
          structureMode={p.structure_mode}
          analysts={analysts}
          trigger={
            <Button variant="outline" size="sm" className="w-full h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add {labels.workPackageShort.toLowerCase()}
            </Button>
          }
        />
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Active {labels.taskPlural.toLowerCase()}
        </p>
        <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
          {node.manufacturers.flatMap((m) =>
            m.years.flatMap((y) =>
              y.packages
                .filter((pkg) => pkg.status !== "done")
                .map((pkg) => (
                  <li key={pkg.id} className="text-muted-foreground truncate">
                    {m.manufacturer.name} · {pkg.title}
                  </li>
                ))
            )
          )}
        </ul>
      </div>
    </div>
  );
}

function ManufacturerPanelBody({
  node,
  projectName,
  projectType,
  structureMode,
}: {
  node: OperationsTree["projects"][0]["manufacturers"][0];
  projectName: string;
  projectType?: string | null;
  structureMode?: string | null;
}) {
  const r = node.rollup;
  const labels = getProgramLabels(projectType, structureMode);
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">Project: {projectName}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{r.completedPct}%</span>
        </div>
        <Progress value={r.completedPct} className="h-2" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label={labels.phasePlural} value={r.yearCount} />
        <Metric label={labels.taskPlural} value={r.totalPackages} />
        <Metric label="Est hours" value={`${r.estimatedHours}h`} />
        <Metric label="Actual hours" value={`${r.hoursLogged}h`} />
        <Metric label="Files" value={r.fileCount} />
        <Metric label="Corrections" value={r.correctionCount} />
      </div>
      <p className="text-xs text-muted-foreground">
        Last activity {formatLastActivity(r.lastActivityAt)}
      </p>
    </div>
  );
}

function YearPanelBody({
  node,
  manufacturerName,
  projectType,
  structureMode,
  analysts,
  forecastSettings,
  canManage,
  onRefresh,
}: {
  node: OperationsTree["projects"][0]["manufacturers"][0]["years"][0];
  manufacturerName: string;
  projectType?: string | null;
  structureMode?: string | null;
  analysts: User[];
  forecastSettings: ForecastSettings;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const y = node.yearWorkItem;
  const r = node.rollup;
  const labels = getProgramLabels(projectType, structureMode);
  const assignee = analysts.find((a) => a.id === y.assigned_to);

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{manufacturerName}</p>
      <div className="grid grid-cols-2 gap-2">
        <Metric label={labels.taskPlural} value={r.totalPackages} />
        <Metric label="Done" value={`${r.completedPct}%`} />
        <Metric label="Est hours" value={`${y.estimated_hours}h`} />
        <Metric label="Actual hours" value={`${y.actual_hours}h`} />
        <Metric label="Files" value={y.file_count} />
        <Metric label="Corrections" value={r.correctionCount} />
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Assigned</dt>
          <dd>{assignee?.full_name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Due date</dt>
          <dd className="tabular-nums">{y.due_date ?? "—"}</dd>
        </div>
      </dl>
      {canManage && (
        <AddWorkPackageDialog
          yearItem={y}
          manufacturerName={manufacturerName}
          analysts={analysts}
          forecastSettings={forecastSettings}
          trigger={
            <Button variant="outline" size="sm" className="w-full h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add {labels.task.toLowerCase()}
            </Button>
          }
        />
      )}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {labels.taskPlural}
        </p>
        <ul className="space-y-1 text-sm">
          {node.packages.map((pkg) => (
            <li key={pkg.id} className="truncate text-muted-foreground">{pkg.title}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
