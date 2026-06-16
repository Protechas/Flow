import { writeAuditLog } from "@/lib/audit/audit-log";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { createNotificationSync, hasRecentNotification } from "@/lib/notifications/notifications";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import type { User } from "@/types/flow";
import type { WorkEligibilityAction } from "./types";

interface BlockedAttempt {
  user_id: string;
  action: WorkEligibilityAction;
  reason: string;
  created_at: string;
}

let blockedAttempts: BlockedAttempt[] = [];

const VIOLATION_WINDOW_MS = 60 * 60 * 1000;
const VIOLATION_THRESHOLD = 3;

const ACTION_LABELS: Record<WorkEligibilityAction, string> = {
  start_task: "Start Task",
  resume_task: "Resume Task",
  complete_task: "Complete Task",
  submit_task: "Submit Task",
  upload_file: "File Upload",
  submit_qa: "Submit QA Work",
  submit_correction: "Submit Correction",
  start_timer: "Start Task Timer",
  resume_timer: "Resume Task Timer",
  pause_timer: "Pause Task Timer",
  stop_timer: "Stop Task Timer",
  log_production: "Log Production",
  mark_documents: "Mark Documents Completed",
  submit_production: "Submit Production Activity",
};

export function blockedActionLabel(action: WorkEligibilityAction): string {
  return ACTION_LABELS[action] ?? action;
}

export async function recordBlockedWorkAttempt(
  user: User,
  action: WorkEligibilityAction,
  reason: string,
  taskId?: string
) {
  const now = new Date().toISOString();
  blockedAttempts = [
    { user_id: user.id, action, reason, created_at: now },
    ...blockedAttempts,
  ].slice(0, 2000);

  await writeAuditLog({
    action: "workflow_alert",
    entityType: "work_eligibility",
    entityId: user.id,
    summary: `Attempted ${blockedActionLabel(action)} while off clock`,
    metadata: {
      event: "work_eligibility_blocked",
      action,
      reason,
      task_id: taskId ?? null,
    },
    actorId: user.id,
    actorEmail: user.email,
  });

  const recent = blockedAttempts.filter(
    (a) =>
      a.user_id === user.id &&
      Date.now() - new Date(a.created_at).getTime() < VIOLATION_WINDOW_MS
  );

  if (recent.length < VIOLATION_THRESHOLD) return;

  initFlowStore();
  const users = getFlowStore().users;
  const leaders = resolveLeadersForEmployee(user, users, {
    includeSeniorManager: true,
    includeAdminFallback: true,
  });

  for (const leader of leaders) {
    if (hasRecentNotification(leader.id, "work_eligibility_alert", "user", user.id, 12)) {
      continue;
    }
    createNotificationSync({
      user_id: leader.id,
      type: "work_eligibility_alert",
      title: "Off-clock work attempts",
      message: `${user.full_name} attempted work ${recent.length} times while off the clock in the last hour.`,
      related_entity_type: "user",
      related_entity_id: user.id,
      link: "/people",
    });
  }
}

export function getRecentBlockedAttempts(userId: string, hours = 24) {
  const since = Date.now() - hours * 60 * 60 * 1000;
  return blockedAttempts.filter(
    (a) => a.user_id === userId && new Date(a.created_at).getTime() >= since
  );
}
