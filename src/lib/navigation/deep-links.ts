import type { OpsSavedViewId } from "@/lib/operations/board-filters";
import type { OpsGroupingId } from "@/lib/operations/task-views";
import type { PortfolioViewMode } from "@/components/projects/project-workspace";
import type { ActivityEvent } from "@/types/flow";

function withQuery(path: string, params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") q.set(key, value);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function operationsHref(opts?: {
  department?: string;
  search?: string;
  package?: string;
  taskId?: string;
  view?: OpsSavedViewId;
  grouping?: OpsGroupingId;
  projectId?: string;
}): string {
  const packageId = opts?.package ?? opts?.taskId;
  return withQuery("/operations", {
    department: opts?.department,
    search: opts?.search,
    package: packageId,
    taskId: opts?.taskId && !opts?.package ? opts.taskId : undefined,
    view: opts?.view && opts.view !== "all" ? opts.view : undefined,
    grouping: opts?.grouping && opts.grouping !== "today" ? opts.grouping : undefined,
    projectId: opts?.projectId,
  });
}

export function projectsHref(opts?: {
  department?: string;
  projectId?: string;
  highlight?: string;
  view?: PortfolioViewMode;
}): string {
  const id = opts?.projectId ?? opts?.highlight;
  if (id) {
    return withQuery(`/projects/${id}`, { department: opts?.department });
  }
  return withQuery("/projects", {
    department: opts?.department,
    view: opts?.view && opts.view !== "cards" ? opts.view : undefined,
  });
}

export function qaCenterHref(opts?: { department?: string; package?: string }): string {
  return withQuery("/qa-center", {
    department: opts?.department,
    package: opts?.package,
  });
}

export function wrapUpsHref(opts?: {
  id?: string;
  status?: "submitted" | "missing" | "overridden";
  reviewed?: "reviewed" | "unreviewed";
  followUp?: boolean;
  userId?: string;
}): string {
  return withQuery("/wrap-ups", {
    id: opts?.id,
    status: opts?.status,
    reviewed: opts?.reviewed,
    followUp: opts?.followUp ? "1" : undefined,
    userId: opts?.userId,
  });
}

export function alertCenterHref(opts?: {
  type?: "help" | "workload" | "wrap_up" | "overdue" | "activity_gaps";
}): string {
  if (opts?.type === "wrap_up") {
    return wrapUpsHref({ status: "missing" });
  }
  if (opts?.type === "overdue") {
    return operationsHref({ view: "overdue" });
  }
  if (opts?.type === "activity_gaps") {
    return "/alert-center#activity-gaps";
  }

  const base = "/alert-center";
  if (!opts?.type) return base;
  const anchors: Record<string, string> = {
    help: "#help-flags",
    workload: "#workload-alerts",
    activity_gaps: "#activity-gaps",
  };
  return `${base}${anchors[opts.type] ?? ""}`;
}

export function peopleHref(userId?: string): string {
  if (!userId) return "/people";
  return `/people/${userId}`;
}

/** Query-param alias for people deep links — redirects to profile path. */
export function peopleQueryHref(userId: string): string {
  return withQuery("/people", { userId });
}

export function orgChartHref(userId?: string): string {
  return withQuery("/org-chart", { userId });
}

export function filesHref(opts?: { taskId?: string }): string {
  return withQuery("/files", { taskId: opts?.taskId });
}

export function projectHealthHref(opts?: {
  search?: string;
  risk?: string;
  projectId?: string;
}): string {
  return withQuery("/project-health", {
    search: opts?.search,
    risk: opts?.risk,
    projectId: opts?.projectId,
  });
}

export function reportsHref(opts?: { department?: string }): string {
  return withQuery("/reports", { department: opts?.department });
}

export function notificationsHref(): string {
  return "/notifications";
}

/** Resolve a deep link for an activity feed event when possible. */
export function activityEventHref(event: ActivityEvent): string | null {
  if (event.work_package_id) {
    if (event.type === "qa_review" || event.type === "submit_qa" || event.type === "correction_received") {
      return qaCenterHref({ package: event.work_package_id });
    }
    return operationsHref({ package: event.work_package_id });
  }
  if (event.type === "help_flag") {
    return alertCenterHref({ type: "help" });
  }
  if (event.user_id) {
    return peopleHref(event.user_id);
  }
  return null;
}

export function parseOpsViewParam(value: string | undefined): OpsSavedViewId | undefined {
  const allowed: OpsSavedViewId[] = [
    "all",
    "my_team",
    "overdue",
    "ready_for_qa",
    "correction_needed",
    "stuck",
    "completed_week",
    "at_risk",
  ];
  if (value && allowed.includes(value as OpsSavedViewId)) {
    return value as OpsSavedViewId;
  }
  return undefined;
}

export function parseOpsGroupingParam(value: string | undefined): OpsGroupingId | undefined {
  const allowed: OpsGroupingId[] = ["hierarchy", "today", "by_program", "by_person"];
  if (value && allowed.includes(value as OpsGroupingId)) {
    return value as OpsGroupingId;
  }
  return undefined;
}

export function parsePortfolioViewParam(value: string | undefined): PortfolioViewMode | undefined {
  if (value === "cards" || value === "structure") return value;
  return undefined;
}
