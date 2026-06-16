import type { OpsSavedViewId } from "@/lib/operations/board-filters";
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
  view?: OpsSavedViewId;
  projectId?: string;
}): string {
  return withQuery("/operations", {
    department: opts?.department,
    search: opts?.search,
    package: opts?.package,
    view: opts?.view && opts.view !== "all" ? opts.view : undefined,
    projectId: opts?.projectId,
  });
}

export function projectsHref(opts?: { department?: string; projectId?: string }): string {
  return withQuery("/projects", {
    department: opts?.department,
    projectId: opts?.projectId,
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
  type?: "help" | "workload" | "wrap_up" | "overdue";
}): string {
  const base = "/alert-center";
  if (!opts?.type) return base;
  const anchors: Record<string, string> = {
    help: "#help-flags",
    workload: "#workload-alerts",
    wrap_up: "#wrap-ups",
    overdue: "#overdue",
  };
  return `${base}${anchors[opts.type] ?? ""}`;
}

export function peopleHref(userId?: string): string {
  return userId ? `/people/${userId}` : "/people";
}

export function orgChartHref(userId?: string): string {
  return withQuery("/org-chart", { userId });
}

export function filesHref(opts?: { taskId?: string }): string {
  return withQuery("/files", { taskId: opts?.taskId });
}

export function projectHealthHref(opts?: { search?: string }): string {
  return withQuery("/project-health", { search: opts?.search });
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
    return operationsHref({ package: event.work_package_id });
  }
  if (event.type === "help_flag") {
    return alertCenterHref({ type: "help" });
  }
  if (event.type === "qa_review" || event.type === "submit_qa" || event.type === "correction_received") {
    return qaCenterHref();
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
