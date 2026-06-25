"use client";

import Link from "next/link";
import { ActivityFeed } from "@/components/enterprise/activity-feed";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { ProjectForecastPanel } from "@/components/forecast/project-forecast-panel";
import { ProjectMetricsPanel } from "@/components/projects/project-metrics-panel";
import { Button } from "@/components/ui/button";
import { businessRiskLabel } from "@/lib/projects/hierarchy-labels";
import { filterProjectActivity } from "@/lib/projects/project-activity";
import {
  buildProjectRollupContext,
  departmentLabel,
  formatLastActivity,
  formatProjectType,
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import {
  canManageProjectMetrics,
  canUpdateProjectMetricValues,
} from "@/lib/metrics/project-metrics-permissions";
import { formatForecastHours } from "@/lib/forecast/engine";
import { operationsHref, qaCenterHref } from "@/lib/navigation/deep-links";
import type {
  ActivityEvent,
  Department,
  Manufacturer,
  QaReview,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { FileUp } from "lucide-react";
import type { ReactNode } from "react";

function SummaryCard({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${warn ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-muted/10"}`}
    >
      <p className="enterprise-label">{label}</p>
      <p className="text-sm font-semibold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ProjectSummaryPanel({
  project,
  packages,
  manufacturers,
  yearItems,
  departments,
  analysts,
  managers,
  qaReviews,
  activity,
  viewer,
  canEdit,
  canDelete: _canDelete,
}: {
  project: ProjectWithStats;
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  departments: Department[];
  analysts: User[];
  managers: User[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  viewer?: User;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const projPackages = packages.filter((p) => p.project_id === project.id);
  const rollup = buildProjectRollupContext(
    project,
    packages,
    manufacturers,
    yearItems,
    qaReviews,
    activity
  );
  const openTasks = projPackages.filter((p) => p.status !== "done").length;
  const completedTasks = projPackages.filter((p) => p.status === "done").length;
  const qaReady = rollup.readyForQa;
  const filesUploaded = projPackages.reduce((s, p) => s + (p.file_count ?? 0), 0);
  const ownerName =
    managers.find((m) => m.id === project.project_owner_id)?.full_name ?? "Unassigned";
  const projectActivity = filterProjectActivity(project.id, packages, activity, project.name);
  const primaryDue =
    project.active_project_due_date ??
    project.manual_project_due_date ??
    project.due_date ??
    project.suggested_project_due_date ??
    "—";
  const forecastDue =
    project.active_project_due_date ??
    project.suggested_project_due_date ??
    project.planning_project_due_date ??
    "—";

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryCard label="Progress" value={`${project.completedPct}%`} />
        <SummaryCard
          label="Risk"
          value={businessRiskLabel(project.project_due_date_status)}
          warn={project.project_due_date_status === "at_risk" || project.project_due_date_status === "behind_capacity"}
        />
        <SummaryCard label="Open tasks" value={openTasks} warn={openTasks > 0} />
        <SummaryCard label="Completed tasks" value={completedTasks} />
        <SummaryCard label="Est. hours" value={formatForecastHours(project.estimated_total_hours)} />
        <SummaryCard label="Actual hours" value={formatForecastHours(rollup.hoursLogged)} />
        <SummaryCard label="QA ready" value={qaReady} warn={qaReady > 0} />
        <SummaryCard label="Files uploaded" value={filesUploaded} />
      </div>

      <div className="space-y-1">
        <DetailRow label="Department" value={departmentLabel(project, departments)} />
        <DetailRow label="Owner / lead" value={ownerName} />
        <DetailRow label="Category" value={formatProjectType(project.project_type)} />
        <DetailRow label="Manual due date" value={project.manual_project_due_date ?? project.due_date ?? "—"} />
        <DetailRow label="Forecasted completion" value={forecastDue} />
        <DetailRow label="Primary due date" value={primaryDue} />
        <DetailRow
          label="Forecast confidence"
          value={`${project.forecast_confidence ?? 0}%`}
        />
        <DetailRow
          label="Capacity status"
          value={<DueDateStatusBadge status={project.project_due_date_status} />}
        />
      </div>

      <ProjectForecastPanel project={project} />

      <ProjectMetricsPanel
        project={project}
        user={viewer}
        canManage={Boolean(viewer && canEdit && canManageProjectMetrics(viewer))}
        canUpdateValues={Boolean(viewer && canUpdateProjectMetricValues(viewer, project))}
      />

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="enterprise-label">Recent activity</p>
          <span className="text-[10px] text-muted-foreground">
            Last: {formatLastActivity(rollup.lastActivityAt)}
          </span>
        </div>
        <div className="enterprise-panel px-2">
          <ActivityFeed
            events={projectActivity}
            maxItems={8}
            emptyTitle="No project activity yet"
            emptyDescription="Activity appears as tasks, files, QA, and metrics change."
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <p className="enterprise-label">Actions</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            render={<Link href={operationsHref({ grouping: "by_program", projectId: project.id })} />}
          >
            View tasks
          </Button>
          {qaReady > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              render={<Link href={qaCenterHref()} />}
            >
              Review QA
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            render={<Link href={`/files?project=${project.id}`} />}
          >
            <FileUp className="h-3.5 w-3.5 mr-1" />
            Files
          </Button>
        </div>
      </div>
    </div>
  );
}
