"use client";

import Link from "next/link";
import { ProjectForecastPanel } from "@/components/forecast/project-forecast-panel";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildManufacturerRollupContext,
  buildProjectRollupContext,
  departmentLabel,
  formatLastActivity,
  formatProjectType,
  healthStatusLabel,
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
    description = project?.name ?? "Manufacturer";
  } else if (selection?.kind === "year" && yearItem && manufacturer) {
    title = `${manufacturer.name} · ${yearItem.year}`;
    description = project?.name ?? "Model year";
  } else if (selection?.kind === "task" && task) {
    title = task.title;
    description = project?.name ?? "Task";
  }

  const assigneeName = (id: string | null | undefined) =>
    id ? analysts.find((a) => a.id === id)?.full_name ?? "—" : "Unassigned";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {selection?.kind === "project" && project && (
            <>
              <div className="space-y-1">
                <DetailRow label="Department" value={departmentLabel(project, departments)} />
                <DetailRow label="Category" value={formatProjectType(project.project_type)} />
                <DetailRow label="Progress" value={`${project.completedPct}%`} />
                <DetailRow
                  label="Health Status"
                  value={
                    <DueDateStatusBadge status={project.project_due_date_status} />
                  }
                />
                <DetailRow
                  label="Forecast Confidence"
                  value={`${project.forecast_confidence ?? 0}%`}
                />
                <DetailRow
                  label="Last Activity"
                  value={formatLastActivity(
                    buildProjectRollupContext(
                      project,
                      packages,
                      manufacturers,
                      yearItems,
                      qaReviews,
                      activity
                    ).lastActivityAt
                  )}
                />
              </div>
              <ProjectForecastPanel project={project} />
              <div>
                <p className="enterprise-label mb-2">Structure</p>
                <p className="text-sm text-muted-foreground">
                  {manufacturers.filter((m) => m.project_id === project.id && !m.is_archived).length}{" "}
                  manufacturers ·{" "}
                  {yearItems.filter((y) => y.project_id === project.id).length} years ·{" "}
                  {packages.filter((p) => p.project_id === project.id).length} tasks
                </p>
              </div>
            </>
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
                    <DetailRow label="Years" value={rollup.yearCount} />
                    <DetailRow label="Tasks" value={rollup.totalPackages} />
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
              <DetailRow label="Manufacturer" value={manufacturer.name} />
              <DetailRow label="Model Year" value={yearItem.year} />
              <DetailRow label="Assigned User" value={assigneeName(yearItem.assigned_to)} />
              <DetailRow label="Status" value={<StatusBadge status={yearItem.status} />} />
              <DetailRow label="Due Date" value={yearItem.due_date ?? "—"} />
              <DetailRow
                label="Tasks"
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

          {project && selection?.kind === "project" && (
            <p className="text-xs text-muted-foreground">
              Health: {healthStatusLabel(project.project_due_date_status)}
              {project.project_due_date_status === "behind_capacity" &&
                " — Due date may be unrealistic based on current capacity."}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
