"use client";

import Link from "next/link";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { ProjectSummaryPanel } from "@/components/projects/project-summary-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HIERARCHY_LABELS } from "@/lib/projects/hierarchy-labels";
import {
  buildManufacturerRollupContext,
  formatLastActivity,
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import { operationsHref } from "@/lib/navigation/deep-links";
import { formatForecastHours } from "@/lib/forecast/engine";
import type {
  ActivityEvent,
  Department,
  Manufacturer,
  QaReview,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export type PortfolioSelection =
  | { kind: "project"; projectId: string }
  | { kind: "manufacturer"; projectId: string; manufacturerId: string }
  | { kind: "year"; projectId: string; manufacturerId: string; yearId: string }
  | { kind: "task"; projectId: string; packageId: string }
  | null;

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ProjectPortfolioDetailPanel({
  selection,
  onClose,
  projects,
  manufacturers,
  yearItems,
  packages,
  departments,
  analysts,
  qaReviews,
  activity,
  viewer,
  canEdit = false,
  canDelete = false,
  managers = [],
}: {
  selection: PortfolioSelection;
  onClose: () => void;
  projects: ProjectWithStats[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  packages: WorkPackage[];
  departments: Department[];
  analysts: User[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  viewer?: User;
  canEdit?: boolean;
  canDelete?: boolean;
  managers?: User[];
}) {
  const open = selection !== null;

  const project =
    selection?.kind === "project"
      ? projects.find((p) => p.id === selection.projectId)
      : selection
        ? projects.find((p) => p.id === selection.projectId)
        : null;

  const manufacturer =
    selection && (selection.kind === "manufacturer" || selection.kind === "year")
      ? manufacturers.find((m) => m.id === selection.manufacturerId)
      : null;

  const yearItem =
    selection?.kind === "year"
      ? yearItems.find((y) => y.id === selection.yearId)
      : null;

  const task =
    selection?.kind === "task"
      ? packages.find((p) => p.id === selection.packageId)
      : null;

  let title = "Details";
  let description = "";

  if (selection?.kind === "project" && project) {
    title = project.name;
    description = "Project portfolio details";
  } else if (selection?.kind === "manufacturer" && manufacturer) {
    title = manufacturer.name;
    description = project?.name ?? HIERARCHY_LABELS.workstream;
  } else if (selection?.kind === "year" && yearItem && manufacturer) {
    title = `${manufacturer.name} · ${yearItem.year}`;
    description = project?.name ?? HIERARCHY_LABELS.phase;
  } else if (selection?.kind === "task" && task) {
    title = task.title;
    description = project?.name ?? "Task";
  }

  const assigneeName = (id: string | null | undefined) =>
    id ? analysts.find((a) => a.id === id)?.full_name ?? "—" : "Unassigned";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {selection?.kind === "project" && project && (
            <ProjectSummaryPanel
              project={project}
              packages={packages}
              manufacturers={manufacturers}
              yearItems={yearItems}
              departments={departments}
              analysts={analysts}
              managers={managers}
              qaReviews={qaReviews}
              activity={activity}
              viewer={viewer}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}

          {selection?.kind === "manufacturer" && manufacturer && project && (
            <>
              {(() => {
                const rollup = buildManufacturerRollupContext(
                  manufacturer,
                  packages,
                  yearItems,
                  qaReviews,
                  activity
                );
                return (
                  <div className="space-y-1">
                    <DetailRow label="Project" value={project.name} />
                    <DetailRow label="Progress" value={`${rollup.completedPct}%`} />
                    <DetailRow label={HIERARCHY_LABELS.phasePlural} value={rollup.yearCount} />
                    <DetailRow label={HIERARCHY_LABELS.taskPlural} value={rollup.totalPackages} />
                    <DetailRow label="Ready for QA" value={rollup.readyForQa} />
                    <DetailRow label="Issue Count" value={rollup.correctionCount + rollup.overdueCount} />
                    <DetailRow
                      label="Last Activity"
                      value={formatLastActivity(rollup.lastActivityAt)}
                    />
                  </div>
                );
              })()}
            </>
          )}

          {selection?.kind === "year" && yearItem && manufacturer && (
            <div className="space-y-1">
              <DetailRow label={HIERARCHY_LABELS.workstream} value={manufacturer.name} />
              <DetailRow label={HIERARCHY_LABELS.phase} value={yearItem.year} />
              <DetailRow label="Assigned User" value={assigneeName(yearItem.assigned_to)} />
              <DetailRow label="Status" value={<StatusBadge status={yearItem.status} />} />
              <DetailRow label="Due Date" value={yearItem.due_date ?? "—"} />
              <DetailRow
                label={HIERARCHY_LABELS.taskPlural}
                value={packages.filter((p) => p.year_work_item_id === yearItem.id).length}
              />
            </div>
          )}

          {selection?.kind === "task" && task && (
            <div className="space-y-4">
              <div className="space-y-1">
                <DetailRow label="Assigned User" value={assigneeName(task.assigned_to)} />
                <DetailRow label="Status" value={<StatusBadge status={task.status} />} />
                <DetailRow label="Due Date" value={task.due_date ?? "—"} />
                <DetailRow label="Estimated Hours" value={formatForecastHours(task.estimated_hours)} />
                <DetailRow
                  label="Documents"
                  value={task.estimated_document_count ?? task.file_count ?? "—"}
                />
                <DetailRow label="QA Status" value={task.qa_status ?? "—"} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                render={<Link href={operationsHref({ package: task.id })} />}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Open in Operations
              </Button>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
