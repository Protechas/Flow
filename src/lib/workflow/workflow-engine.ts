import {
  createNotificationSync,
  hasRecentNotification,
} from "@/lib/notifications/notifications";
import { isOverdue } from "@/lib/scoring/flow-score";
import {
  getManagerForEmployee,
  getManagers,
  getManagersForPackage,
  getProjectOwner,
  getQaUsers,
  parseMentionedUserIds,
  workPackageLink,
} from "@/lib/workflow/recipients";
import { operationsHref, qaCenterHref } from "@/lib/navigation/deep-links";
import type {
  Correction,
  NotificationType,
  Project,
  QaResult,
  User,
  WorkPackage,
  WorkStatus,
} from "@/types/flow";
import { differenceInHours, format, isSameDay, parseISO, startOfDay } from "date-fns";

export const WORKFLOW_THRESHOLDS = {
  QA_QUEUE_ALERT: 5,
  EMPLOYEE_OVERDUE_ALERT: 3,
  EMPLOYEE_CORRECTION_ALERT: 3,
  EMPLOYEE_ACTIVE_LOAD: 8,
  STUCK_HOURS: 24,
  PROJECT_RISK_OVERDUE_RATIO: 0.3,
  DEDUPE_HOURS: 24,
};

export interface WorkflowContext {
  users: User[];
  projects: Project[];
  packages: WorkPackage[];
}

let lastScheduledRun = 0;
const SCHEDULED_INTERVAL_MS = 5 * 60 * 1000;

function notify(
  ctx: WorkflowContext,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
    link?: string;
    dedupe?: boolean;
  }
) {
  if (!input.userId) return;
  const user = ctx.users.find((u) => u.id === input.userId && u.is_active);
  if (!user) return;

  if (input.dedupe !== false && hasRecentNotification(
    input.userId,
    input.type,
    input.entityType,
    input.entityId,
    WORKFLOW_THRESHOLDS.DEDUPE_HOURS
  )) {
    return;
  }

  createNotificationSync({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    related_entity_type: input.entityType,
    related_entity_id: input.entityId,
    link: input.link ?? workPackageLink(input.entityId, user.role),
  });
}

function pkgById(ctx: WorkflowContext, id: string): WorkPackage | undefined {
  return ctx.packages.find((p) => p.id === id);
}

export function onAssignment(
  ctx: WorkflowContext,
  pkg: WorkPackage,
  prevAssignee: string | null | undefined,
  actorId?: string
) {
  if (prevAssignee && prevAssignee !== pkg.assigned_to && prevAssignee !== actorId) {
    notify(ctx, {
      userId: prevAssignee,
      type: "assignment_changed",
      title: "Assignment removed",
      message: `You were unassigned from "${pkg.title}".`,
      entityType: "work_package",
      entityId: pkg.id,
      dedupe: false,
    });
  }

  if (!pkg.assigned_to || pkg.assigned_to === prevAssignee) return;
  if (pkg.assigned_to === actorId) return;

  const isReassignment = !!prevAssignee && prevAssignee !== pkg.assigned_to;

  notify(ctx, {
    userId: pkg.assigned_to,
    type: isReassignment ? "assignment_changed" : "new_assignment",
    title: isReassignment ? "Work reassigned to you" : "New work assigned",
    message: isReassignment
      ? `"${pkg.title}" was reassigned to you.`
      : `You were assigned "${pkg.title}".`,
    entityType: "work_package",
    entityId: pkg.id,
    dedupe: false,
  });
}

export function onStatusChange(
  ctx: WorkflowContext,
  pkg: WorkPackage,
  prevStatus: WorkStatus,
  actorId?: string
) {
  if (pkg.status === prevStatus) return;

  if (pkg.status === "ready_for_qa") {
    onSubmitToQA(ctx, pkg, actorId);
    return;
  }

  if (pkg.status === "working_on_it") {
    onTaskStart(ctx, pkg, actorId);
    return;
  }

  if (pkg.status === "done") {
    onTaskComplete(ctx, pkg, actorId);
    return;
  }

  if (
    pkg.status === "correction_needed" &&
    prevStatus !== "correction_needed" &&
    !["in_qa", "ready_for_qa"].includes(prevStatus)
  ) {
    if (pkg.assigned_to) {
      notify(ctx, {
        userId: pkg.assigned_to,
        type: "correction_issued",
        title: "Correction needed",
        message: `QA returned "${pkg.title}" for corrections.`,
        entityType: "work_package",
        entityId: pkg.id,
      });
    }
  }

  if (pkg.status === "stuck") {
    onTaskStuck(ctx, pkg);
  }
}

export function onSubmitToQA(ctx: WorkflowContext, pkg: WorkPackage, _actorId?: string) {
  for (const qa of getQaUsers(ctx.users)) {
    notify(ctx, {
      userId: qa.id,
      type: "qa_review_needed",
      title: "Work submitted to QA",
      message: `"${pkg.title}" is ready for QA review.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: qaCenterHref({ package: pkg.id }),
    });
  }
  checkQaBacklog(ctx);
}

export function onQAReview(
  ctx: WorkflowContext,
  pkg: WorkPackage,
  result: QaResult,
  reviewerId: string
) {
  if (result === "pass") {
    if (pkg.assigned_to) {
      notify(ctx, {
        userId: pkg.assigned_to,
        type: "qa_passed",
        title: "QA passed",
        message: `"${pkg.title}" passed QA review.`,
        entityType: "work_package",
        entityId: pkg.id,
        dedupe: false,
      });
    }
    return;
  }

  if (pkg.assigned_to) {
    notify(ctx, {
      userId: pkg.assigned_to,
      type: "qa_rejected",
      title: "QA rejected",
      message: `QA returned "${pkg.title}" — ${result.replace("_", " ")}.`,
      entityType: "work_package",
      entityId: pkg.id,
      dedupe: false,
    });
  }

  const managers = getManagersForPackage(pkg, ctx.users, ctx.projects);
  for (const mgr of managers) {
    if (mgr.id === reviewerId) continue;
    notify(ctx, {
      userId: mgr.id,
      type: "qa_rejected",
      title: "QA rejected on team task",
      message: `"${pkg.title}" needs corrections after QA review.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: operationsHref({ package: pkg.id }),
    });
  }
}

export function onResubmitToQA(ctx: WorkflowContext, pkg: WorkPackage) {
  if (pkg.status !== "ready_for_qa") return;
  const wasRejected = pkg.qa_status === "rejected" || pkg.correction_count > 0;
  if (!wasRejected) return;

  for (const qa of getQaUsers(ctx.users)) {
    notify(ctx, {
      userId: qa.id,
      type: "qa_review_needed",
      title: "Work resubmitted to QA",
      message: `"${pkg.title}" was resubmitted after corrections.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: qaCenterHref({ package: pkg.id }),
      dedupe: false,
    });
  }
}

export function onCorrectionIssued(ctx: WorkflowContext, correction: Correction, pkg: WorkPackage) {
  notify(ctx, {
    userId: correction.assigned_to,
    type: "correction_issued",
    title: "Correction assigned",
    message: correction.description.slice(0, 120),
    entityType: "work_package",
    entityId: pkg.id,
    dedupe: false,
  });
}

export function onCorrectionResolved(ctx: WorkflowContext, correction: Correction, pkg: WorkPackage) {
  const managers = getManagersForPackage(pkg, ctx.users, ctx.projects);
  for (const mgr of managers) {
    notify(ctx, {
      userId: mgr.id,
      type: "correction_resolved",
      title: "Correction resolved",
      message: `Correction on "${pkg.title}" was resolved.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: operationsHref({ package: pkg.id }),
    });
  }
}

export function onComment(
  ctx: WorkflowContext,
  pkg: WorkPackage,
  authorId: string,
  body: string
) {
  const author = ctx.users.find((u) => u.id === authorId);
  const mentioned = parseMentionedUserIds(body, ctx.users).filter((id) => id !== authorId);

  for (const userId of mentioned) {
    notify(ctx, {
      userId,
      type: "comment_mention",
      title: "You were mentioned",
      message: `${author?.full_name ?? "Someone"} mentioned you on "${pkg.title}".`,
      entityType: "work_package",
      entityId: pkg.id,
      dedupe: false,
    });
  }

  if (
    pkg.assigned_to &&
    pkg.assigned_to !== authorId &&
    (author?.role === "manager" || author?.role === "admin")
  ) {
    notify(ctx, {
      userId: pkg.assigned_to,
      type: "comment_mention",
      title: "Manager comment",
      message: `${author.full_name} commented on "${pkg.title}".`,
      entityType: "work_package",
      entityId: pkg.id,
      dedupe: false,
    });
  }
}

export function onFileUpload(ctx: WorkflowContext, pkg: WorkPackage, uploaderId: string) {
  if (pkg.assigned_to && pkg.assigned_to !== uploaderId) {
    notify(ctx, {
      userId: pkg.assigned_to,
      type: "file_uploaded",
      title: "File uploaded",
      message: `A file was uploaded to "${pkg.title}".`,
      entityType: "work_package",
      entityId: pkg.id,
    });
  }
}

export function onTaskStart(ctx: WorkflowContext, pkg: WorkPackage, _actorId?: string) {
  // Activity logged in flow-store; status already set to working_on_it
}

export function onTaskPause(
  ctx: WorkflowContext,
  pkg: WorkPackage,
  _actorId: string,
  _hours: number
) {
  // Time log created in flow-store
}

export function onTaskComplete(ctx: WorkflowContext, pkg: WorkPackage, _actorId?: string) {
  const managers = getManagersForPackage(pkg, ctx.users, ctx.projects);
  for (const mgr of managers) {
    notify(ctx, {
      userId: mgr.id,
      type: "qa_passed",
      title: "Task completed",
      message: `"${pkg.title}" was marked complete.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: operationsHref({ package: pkg.id }),
    });
  }
}

export function onTaskOverdue(ctx: WorkflowContext, pkg: WorkPackage) {
  if (pkg.assigned_to) {
    notify(ctx, {
      userId: pkg.assigned_to,
      type: "task_overdue",
      title: "Task overdue",
      message: `"${pkg.title}" is past its due date.`,
      entityType: "work_package",
      entityId: pkg.id,
    });
  }

  for (const mgr of getManagersForPackage(pkg, ctx.users, ctx.projects)) {
    notify(ctx, {
      userId: mgr.id,
      type: "task_overdue",
      title: "Overdue work on your team",
      message: `"${pkg.title}" is overdue.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: operationsHref({ package: pkg.id }),
    });
  }
}

export function onTaskDueSoon(ctx: WorkflowContext, pkg: WorkPackage) {
  if (!pkg.assigned_to || !pkg.due_date) return;
  notify(ctx, {
    userId: pkg.assigned_to,
    type: "task_due_soon",
    title: "Task due today",
    message: `"${pkg.title}" is due ${format(parseISO(pkg.due_date), "MMM d")}.`,
    entityType: "work_package",
    entityId: pkg.id,
  });
}

export function onTaskStuck(ctx: WorkflowContext, pkg: WorkPackage) {
  for (const mgr of getManagersForPackage(pkg, ctx.users, ctx.projects)) {
    notify(ctx, {
      userId: mgr.id,
      type: "work_stuck",
      title: "Work stuck",
      message: `"${pkg.title}" has been stuck too long.`,
      entityType: "work_package",
      entityId: pkg.id,
      link: operationsHref({ package: pkg.id }),
    });
  }
}

function checkQaBacklog(ctx: WorkflowContext) {
  const queue = ctx.packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status));
  if (queue.length < WORKFLOW_THRESHOLDS.QA_QUEUE_ALERT) return;

  for (const qa of getQaUsers(ctx.users)) {
    notify(ctx, {
      userId: qa.id,
      type: "qa_review_needed",
      title: "QA backlog growing",
      message: `${queue.length} items are waiting in the QA queue.`,
      entityType: "qa_queue",
      entityId: "queue",
      link: qaCenterHref(),
    });
  }
}

function checkEmployeeLoad(ctx: WorkflowContext, employeeId: string) {
  const employee = ctx.users.find((u) => u.id === employeeId);
  if (!employee) return;

  const mine = ctx.packages.filter((p) => p.assigned_to === employeeId);
  const overdue = mine.filter(isOverdue);
  const openCorrections = mine.filter(
    (p) => p.status === "correction_needed" || ["minor_correction", "major_correction"].includes(p.qa_status)
  );
  const active = mine.filter((p) => !["done", "not_started"].includes(p.status));

  const mgr = getManagerForEmployee(employeeId, ctx.users);
  if (!mgr) return;

  if (overdue.length >= WORKFLOW_THRESHOLDS.EMPLOYEE_OVERDUE_ALERT) {
    notify(ctx, {
      userId: mgr.id,
      type: "employee_overloaded",
      title: "Employee overdue workload",
      message: `${employee.full_name} has ${overdue.length} overdue items.`,
      entityType: "user",
      entityId: employeeId,
      link: "/people",
    });
  }

  if (openCorrections.length >= WORKFLOW_THRESHOLDS.EMPLOYEE_CORRECTION_ALERT) {
    notify(ctx, {
      userId: mgr.id,
      type: "employee_overloaded",
      title: "High correction count",
      message: `${employee.full_name} has ${openCorrections.length} open corrections.`,
      entityType: "user",
      entityId: employeeId,
      link: "/people",
    });
  }

  if (active.length >= WORKFLOW_THRESHOLDS.EMPLOYEE_ACTIVE_LOAD) {
    notify(ctx, {
      userId: mgr.id,
      type: "employee_overloaded",
      title: "Employee overloaded",
      message: `${employee.full_name} has ${active.length} active tasks.`,
      entityType: "user",
      entityId: employeeId,
      link: "/people",
    });
  }
}

function checkProjectRisk(ctx: WorkflowContext, projectId: string) {
  const project = ctx.projects.find((p) => p.id === projectId);
  if (!project) return;

  const pkgs = ctx.packages.filter((p) => p.project_id === projectId && p.status !== "done");
  if (!pkgs.length) return;

  const overdue = pkgs.filter(isOverdue);
  const overdueRatio = overdue.length / pkgs.length;

  if (overdueRatio < WORKFLOW_THRESHOLDS.PROJECT_RISK_OVERDUE_RATIO) return;

  const owner = getProjectOwner(projectId, ctx.projects, ctx.users);
  const recipients = owner ? [owner] : getManagers(ctx.users);

  for (const u of recipients) {
    notify(ctx, {
      userId: u.id,
      type: "project_at_risk",
      title: "Project at risk",
      message: `${project.name} has ${overdue.length} overdue items (${Math.round(overdueRatio * 100)}% of open work).`,
      entityType: "project",
      entityId: projectId,
      link: "/project-health",
    });
  }
}

export function runScheduledWorkflowChecks(
  ctx: WorkflowContext,
  force = false
): { stuckPackageIds: string[] } {
  const now = Date.now();
  const stuckPackageIds: string[] = [];
  if (!force && now - lastScheduledRun < SCHEDULED_INTERVAL_MS) {
    return { stuckPackageIds };
  }
  lastScheduledRun = now;

  const today = startOfDay(new Date());

  for (const pkg of ctx.packages) {
    if (pkg.status === "done") continue;

    if (isOverdue(pkg)) {
      onTaskOverdue(ctx, pkg);
    } else if (pkg.due_date && isSameDay(parseISO(pkg.due_date), today)) {
      onTaskDueSoon(ctx, pkg);
    }

    const idleHours = differenceInHours(now, parseISO(pkg.updated_at));
    const stalled =
      ["waiting", "working_on_it"].includes(pkg.status) &&
      idleHours >= WORKFLOW_THRESHOLDS.STUCK_HOURS;

    if (stalled && pkg.status !== "stuck") {
      stuckPackageIds.push(pkg.id);
    } else if (pkg.status === "stuck") {
      onTaskStuck(ctx, pkg);
    }
  }

  const employeeIds = new Set(
    ctx.packages.map((p) => p.assigned_to).filter((id): id is string => !!id)
  );
  for (const id of employeeIds) {
    checkEmployeeLoad(ctx, id);
  }

  for (const project of ctx.projects) {
    if (project.status === "archived") continue;
    checkProjectRisk(ctx, project.id);
  }

  checkQaBacklog(ctx);
  return { stuckPackageIds };
}

export function buildWorkflowContext(store: {
  users: User[];
  projects: Project[];
  workPackages: WorkPackage[];
}): WorkflowContext {
  return {
    users: store.users,
    projects: store.projects,
    packages: store.workPackages,
  };
}

export function dispatchWorkflow(
  event:
    | { type: "assignment"; pkgId: string; prevAssignee?: string | null; actorId?: string }
    | { type: "status_change"; pkgId: string; prevStatus: WorkStatus; actorId?: string }
    | { type: "submit_qa"; pkgId: string; actorId?: string }
    | { type: "qa_review"; pkgId: string; result: QaResult; reviewerId: string }
    | { type: "correction"; correctionId: string; pkgId: string }
    | { type: "correction_resolved"; correctionId: string; pkgId: string }
    | { type: "comment"; pkgId: string; authorId: string; body: string }
    | { type: "file_upload"; pkgId: string; uploaderId: string }
    | { type: "task_pause"; pkgId: string; actorId: string; hours: number },
  ctx: WorkflowContext,
  extras?: { corrections?: Correction[] }
) {
  const pkg = pkgById(ctx, event.pkgId ?? "");
  if (!pkg && event.type !== "correction" && event.type !== "correction_resolved") return;

  switch (event.type) {
    case "assignment":
      if (pkg) onAssignment(ctx, pkg, event.prevAssignee, event.actorId);
      break;
    case "status_change":
      if (pkg) {
        onStatusChange(ctx, pkg, event.prevStatus, event.actorId);
        if (event.prevStatus === "correction_needed" && pkg.status === "ready_for_qa") {
          onResubmitToQA(ctx, pkg);
        }
      }
      break;
    case "submit_qa":
      if (pkg) onSubmitToQA(ctx, pkg, event.actorId);
      break;
    case "qa_review":
      if (pkg) onQAReview(ctx, pkg, event.result, event.reviewerId);
      break;
    case "correction": {
      const corr = extras?.corrections?.find((c) => c.id === event.correctionId);
      if (corr && pkg) onCorrectionIssued(ctx, corr, pkg);
      break;
    }
    case "correction_resolved": {
      const corr = extras?.corrections?.find((c) => c.id === event.correctionId);
      if (corr && pkg) onCorrectionResolved(ctx, corr, pkg);
      break;
    }
    case "comment":
      if (pkg) onComment(ctx, pkg, event.authorId, event.body);
      break;
    case "file_upload":
      if (pkg) onFileUpload(ctx, pkg, event.uploaderId);
      break;
    case "task_pause":
      if (pkg) onTaskPause(ctx, pkg, event.actorId, event.hours);
      break;
  }
}
