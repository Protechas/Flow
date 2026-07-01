import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import { canAssignWork } from "@/lib/auth/permissions";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getFlowStore } from "@/lib/data/flow-store";
import { logActivityBridge } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { getHelpFlagSettings } from "@/lib/help-flags/hydrate";
import {
  avgHelpFlagResolutionMinutes,
  avgHelpFlagResponseMinutes,
  countHelpFlagsForEmployee,
  createHelpFlagRecord,
  findOpenHelpFlagForTask,
  findOpenHelpFlagForWrapUp,
  getHelpFlagById,
  listHelpFlagRecords,
  listOpenHelpFlags,
  updateHelpFlagRecord,
} from "@/lib/help-flags/store";
import {
  deliverNotification,
} from "@/lib/notifications/notifications";
import { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";
import type {
  HelpFlagReason,
  HelpFlagRecord,
  HelpFlagReportMetrics,
  HelpFlagSeverity,
  HelpFlagView,
  User,
  WorkPackage,
} from "@/types/flow";

export { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";

function getHelpFlagRecipients(employee: User, users: User[]): User[] {
  return resolveLeadersForEmployee(employee, users, {
    includeSeniorManager: true,
    includeAdminFallback: true,
  });
}

function notifyRecipients(
  recipients: User[],
  type: "help_flag_raised" | "help_flag_escalated" | "help_flag_acknowledged" | "help_flag_resolved",
  title: string,
  message: string,
  entityType: string,
  entityId: string,
  link: string,
  dedupeHours = 1
) {
  for (const r of recipients) {
    deliverNotification(
      {
        user_id: r.id,
        type,
        title,
        message,
        related_entity_type: entityType,
        related_entity_id: entityId,
        link,
      },
      dedupeHours
    );
  }
}

function computeSeverity(
  employeeId: string,
  taskId?: string | null
): HelpFlagSeverity {
  initProductionTracking();
  const settings = getHelpFlagSettings();
  const clockedIn = !!getActiveClockEntry(employeeId);
  const activeTimer = getActiveTaskTimeEntry(employeeId);

  if (!clockedIn) return "warning";

  if (!activeTimer || (taskId && activeTimer.task_id !== taskId)) {
    return "critical";
  }

  const started = new Date(activeTimer.resumed_at ?? activeTimer.started_at).getTime();
  const idleMinutes = (Date.now() - started) / 60000;
  if (idleMinutes >= settings.critical_idle_minutes) {
    return "critical";
  }

  return "warning";
}

export interface RaiseHelpFlagInput {
  employee: User;
  reason: HelpFlagReason;
  notes?: string | null;
  source: HelpFlagRecord["source"];
  task?: WorkPackage | null;
  wrapUpId?: string | null;
}

export function raiseHelpFlag(input: RaiseHelpFlagInput): HelpFlagRecord {
  const settings = getHelpFlagSettings();
  if (!settings.enabled) {
    throw new Error("Help flags are disabled");
  }

  const store = getFlowStore();
  const { employee, task } = input;

  if (task && input.source !== "wrap_up") {
    const existing = findOpenHelpFlagForTask(employee.id, task.id);
    if (existing) return existing;
  }

  if (input.wrapUpId) {
    const existingWrap = findOpenHelpFlagForWrapUp(employee.id, input.wrapUpId);
    if (existingWrap) return existingWrap;
  }

  if (input.source === "wrap_up") {
    const existingWrapDay = listHelpFlagRecords().find(
      (r) =>
        r.employee_id === employee.id &&
        r.source === "wrap_up" &&
        ["open", "acknowledged", "in_progress"].includes(r.status)
    );
    if (existingWrapDay) return existingWrapDay;
  }

  const severity = computeSeverity(employee.id, task?.id);
  const deptId = getUserPrimaryDepartmentId(employee.id);

  const record = createHelpFlagRecord({
    employee_id: employee.id,
    department_id: deptId,
    team_id: employee.team_id ?? null,
    board_id: null,
    project_id: task?.project_id ?? null,
    task_id: task?.id ?? null,
    reason: input.reason,
    notes: input.notes?.trim() || null,
    status: "open",
    severity,
    source: input.source,
    acknowledged_by: null,
    acknowledged_at: null,
    leader_note: null,
    resolved_by: null,
    resolved_at: null,
    resolution_notes: null,
    dismissed_by: null,
    dismissed_at: null,
    dismissal_reason: null,
    escalated_at: null,
    wrap_up_id: input.wrapUpId ?? null,
  });

  const reasonLabel = HELP_FLAG_REASON_LABELS[input.reason];
  const taskLabel = task?.title ? ` on "${task.title}"` : "";
  const summary = `${employee.full_name} flagged for help (${reasonLabel})${taskLabel}`;

  logActivityBridge(
    employee.id,
    "help_flag",
    summary,
    task?.id
  );

  const recipients = getHelpFlagRecipients(employee, store.users);
  const link = task ? `/operations?package=${task.id}` : `/people/${employee.id}`;

  notifyRecipients(
    recipients,
    "help_flag_raised",
    "Help requested",
    summary,
    "help_flag",
    record.id,
    link,
    0.5
  );

  deliverNotification({
    user_id: employee.id,
    type: "help_flag_raised",
    title: "Help request submitted",
    message: `Your help request (${reasonLabel}) was sent to your team lead.`,
    related_entity_type: "help_flag",
    related_entity_id: record.id,
    link: task ? `/work/${task.id}` : "/work",
  });

  return record;
}

export function runHelpFlagEscalations(users: User[]): number {
  const settings = getHelpFlagSettings();
  if (!settings.enabled) return 0;

  const thresholdMs = settings.escalation_minutes * 60 * 1000;
  let escalated = 0;

  for (const flag of listOpenHelpFlags()) {
    if (flag.status !== "open" || flag.escalated_at) continue;
    const age = Date.now() - new Date(flag.created_at).getTime();
    if (age < thresholdMs) continue;

    const employee = users.find((u) => u.id === flag.employee_id);
    if (!employee) continue;

    updateHelpFlagRecord(flag.id, {
      escalated_at: new Date().toISOString(),
      severity: "critical",
    });

    const admins = users.filter((u) => u.is_active && u.role === "admin");
    const managers = users.filter(
      (u) =>
        u.is_active &&
        u.role === "manager" &&
        getUserPrimaryDepartmentId(u.id) === getUserPrimaryDepartmentId(employee.id)
    );

    const recipients = [...managers, ...admins];
    const link = flag.task_id
      ? `/operations?package=${flag.task_id}`
      : `/people/${employee.id}`;

    notifyRecipients(
      recipients,
      "help_flag_escalated",
      "Help request escalated",
      `${employee.full_name}'s help request has been open ${settings.escalation_minutes}+ minutes without acknowledgement.`,
      "help_flag",
      flag.id,
      link,
      2
    );

    escalated += 1;
  }

  return escalated;
}

function employeeInScope(employee: User, viewer: User, users: User[]): boolean {
  return canViewerSeeUser(viewer, employee.id, users, getFlowStore().teams);
}

function recordToView(
  record: HelpFlagRecord,
  users: User[],
  packages: WorkPackage[],
  viewer: User
): HelpFlagView {
  const store = getFlowStore();
  const employee = users.find((u) => u.id === record.employee_id);
  const dept = store.departments?.find((d) => d.id === record.department_id);
  const team = store.teams?.find((t) => t.id === record.team_id);
  const task = record.task_id
    ? packages.find((p) => p.id === record.task_id)
    : null;
  const project = record.project_id
    ? store.projects.find((p) => p.id === record.project_id)
    : null;
  const ackUser = record.acknowledged_by
    ? users.find((u) => u.id === record.acknowledged_by)
    : null;
  const resUser = record.resolved_by
    ? users.find((u) => u.id === record.resolved_by)
    : null;

  const canRespond =
    ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(viewer.role) &&
    employee != null &&
    employeeInScope(employee, viewer, users);

  return {
    ...record,
    employee_name: employee?.full_name ?? "Unknown",
    department_name: dept?.name ?? null,
    team_name: team?.name ?? null,
    task_title: task?.title ?? null,
    project_name: project?.name ?? null,
    acknowledged_by_name: ackUser?.full_name ?? null,
    resolved_by_name: resUser?.full_name ?? null,
    can_respond: canRespond,
    can_assign: canAssignWork(viewer.role),
  };
}

export function listHelpFlagsForViewer(
  viewer: User,
  packages: WorkPackage[],
  users: User[],
  options?: { statusFilter?: HelpFlagRecord["status"][]; limit?: number }
): HelpFlagView[] {
  runHelpFlagEscalations(users);

  const statuses = options?.statusFilter ?? [
    "open",
    "acknowledged",
    "in_progress",
  ];

  const records = listHelpFlagRecords().filter((r) => {
    const employee = users.find((u) => u.id === r.employee_id);
    if (!employee || !employeeInScope(employee, viewer, users)) return false;
    return statuses.includes(r.status);
  });

  return records
    .map((r) => recordToView(r, users, packages, viewer))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, options?.limit ?? 50);
}

export function listEmployeeHelpFlags(
  employeeId: string,
  packages: WorkPackage[],
  users: User[]
): HelpFlagView[] {
  const viewer = users.find((u) => u.id === employeeId);
  if (!viewer) return [];
  return listHelpFlagsForViewer(viewer, packages, users, {
    statusFilter: ["open", "acknowledged", "in_progress", "resolved", "dismissed"],
    limit: 20,
  }).filter((f) => f.employee_id === employeeId);
}

export function getHelpFlagView(
  id: string,
  viewer: User,
  packages: WorkPackage[],
  users: User[]
): HelpFlagView | null {
  const record = getHelpFlagById(id);
  if (!record) return null;
  const employee = users.find((u) => u.id === record.employee_id);
  if (!employee || !employeeInScope(employee, viewer, users)) return null;
  return recordToView(record, users, packages, viewer);
}

export function acknowledgeHelpFlag(
  id: string,
  leader: User,
  note?: string | null
): HelpFlagRecord | null {
  const record = getHelpFlagById(id);
  if (!record) return null;

  const updated = updateHelpFlagRecord(id, {
    status: "acknowledged",
    acknowledged_by: leader.id,
    acknowledged_at: new Date().toISOString(),
    leader_note: note?.trim() || record.leader_note,
  });
  if (!updated) return null;

  const employee = getFlowStore().users.find((u) => u.id === record.employee_id);
  if (employee) {
    deliverNotification({
      user_id: employee.id,
      type: "help_flag_acknowledged",
      title: "Help request acknowledged",
      message: `${leader.full_name} acknowledged your help request.`,
      related_entity_type: "help_flag",
      related_entity_id: id,
      link: record.task_id ? `/work/${record.task_id}` : "/work",
    });
  }

  return updated;
}

export function markHelpFlagInProgress(
  id: string,
  leader: User,
  note?: string | null
): HelpFlagRecord | null {
  return updateHelpFlagRecord(id, {
    status: "in_progress",
    acknowledged_by: leader.id,
    acknowledged_at: new Date().toISOString(),
    leader_note: note?.trim() || undefined,
  });
}

export function resolveHelpFlag(
  id: string,
  leader: User,
  resolutionNotes?: string | null
): HelpFlagRecord | null {
  const record = getHelpFlagById(id);
  if (!record) return null;

  const updated = updateHelpFlagRecord(id, {
    status: "resolved",
    resolved_by: leader.id,
    resolved_at: new Date().toISOString(),
    resolution_notes: resolutionNotes?.trim() || null,
  });
  if (!updated) return null;

  const employee = getFlowStore().users.find((u) => u.id === record.employee_id);
  if (employee) {
    deliverNotification({
      user_id: employee.id,
      type: "help_flag_resolved",
      title: "Help request resolved",
      message: resolutionNotes?.trim()
        ? `${leader.full_name} resolved your request: ${resolutionNotes.trim()}`
        : `${leader.full_name} marked your help request as resolved.`,
      related_entity_type: "help_flag",
      related_entity_id: id,
      link: record.task_id ? `/work/${record.task_id}` : "/work",
    });

    logActivityBridge(
      leader.id,
      "help_flag",
      `Resolved help request for ${employee.full_name}`,
      record.task_id ?? undefined
    );
  }

  return updated;
}

export function dismissHelpFlag(
  id: string,
  leader: User,
  reason?: string | null
): HelpFlagRecord | null {
  return updateHelpFlagRecord(id, {
    status: "dismissed",
    dismissed_by: leader.id,
    dismissed_at: new Date().toISOString(),
    dismissal_reason: reason?.trim() || null,
  });
}

export function buildHelpFlagSummary(
  flags: HelpFlagView[]
): { open: number; critical: number; escalated: number } {
  return {
    open: flags.length,
    critical: flags.filter((f) => f.severity === "critical").length,
    escalated: flags.filter((f) => f.escalated_at).length,
  };
}

export function buildHelpFlagReportMetrics(
  users: User[],
  teamMemberIds?: string[]
): HelpFlagReportMetrics {
  runHelpFlagEscalations(users);
  let records = listHelpFlagRecords();

  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    records = records.filter((r) => ids.has(r.employee_id));
  }

  const store = getFlowStore();
  const open = records.filter((r) =>
    ["open", "acknowledged", "in_progress"].includes(r.status)
  );

  const byDept = new Map<string, { departmentName: string; count: number }>();
  for (const r of records) {
    const deptId = r.department_id ?? "unassigned";
    const dept = store.departments?.find((d) => d.id === deptId);
    const cur = byDept.get(deptId) ?? {
      departmentName: dept?.name ?? "Unassigned",
      count: 0,
    };
    cur.count += 1;
    byDept.set(deptId, cur);
  }

  const byReason = new Map<HelpFlagReason, number>();
  for (const r of records) {
    byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
  }

  const repeated = users
    .filter((u) => u.is_active && u.role === "employee")
    .map((u) => ({
      userId: u.id,
      name: u.full_name,
      count: countHelpFlagsForEmployee(u.id, 30),
    }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRequests: records.length,
    openCount: open.length,
    byDepartment: [...byDept.entries()].map(([departmentId, v]) => ({
      departmentId,
      departmentName: v.departmentName,
      count: v.count,
    })),
    byReason: [...byReason.entries()].map(([reason, count]) => ({ reason, count })),
    avgResponseTimeMinutes: avgHelpFlagResponseMinutes(),
    avgResolutionTimeMinutes: avgHelpFlagResolutionMinutes(),
    repeatedBlockers: repeated,
    unresolvedCount: open.length,
  };
}
