"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { getEmployeeTasks } from "@/lib/employee/tasks";
import { buildTaskSubmitChecklist } from "@/lib/employee/submit-checklist";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import { createNotificationSync, hasRecentNotification } from "@/lib/notifications/notifications";
import { upsertWorkloadAlertRecord } from "@/lib/workload-alerts/store";

const PATHS = ["/work", "/operations", "/alert-center", "/executive", "/people", "/reports"];

function revalidateEmployeePaths() {
  PATHS.forEach((p) => revalidatePath(p));
}

async function requireEmployee() {
  const user = await requireUser();
  if (!isEmployeeRole(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function requestWorkAction(notes?: string) {
  const user = await requireEmployee();
  initFlowStore();

  const board = getEmployeeTasks(user.id);
  const hasOpenWork = board.all.some(
    (t) => !["done", "ready_for_qa", "in_qa"].includes(t.status)
  );
  if (hasOpenWork) {
    return {
      ok: false as const,
      message: "You already have assigned work. Start your next task instead.",
    };
  }

  const deptId = getUserPrimaryDepartmentId(user.id);
  upsertWorkloadAlertRecord({
    employee_id: user.id,
    department_id: deptId,
    team_id: user.team_id ?? null,
    alert_type: "no_assigned_work",
    severity: "warning",
    remaining_hours: 0,
    current_task_id: null,
    status: "open",
    recommended_action: "Employee requested additional work assignment.",
    reviewed_by: null,
    reviewed_at: null,
    snoozed_until: null,
    dismissed_by: null,
    dismissed_at: null,
  });

  const store = getFlowStore();
  const leaders = resolveLeadersForEmployee(user, store.users, {
    includeSeniorManager: true,
    includeAdminFallback: true,
  });

  for (const leader of leaders) {
    if (hasRecentNotification(leader.id, "workload_empty", "user", user.id, 8)) continue;
    createNotificationSync({
      user_id: leader.id,
      type: "workload_empty",
      title: "Work requested",
      message: `${user.full_name} requested additional work assignment.${
        notes?.trim() ? ` Note: ${notes.trim()}` : ""
      }`,
      related_entity_type: "user",
      related_entity_id: user.id,
      link: `/people/${user.id}`,
    });
  }

  await writeAuditLog({
    action: "workflow_alert",
    entityType: "work_eligibility",
    entityId: user.id,
    summary: "Employee requested work",
    metadata: {
      event: "employee_request_work",
      notes: notes?.trim() ?? null,
    },
    actorId: user.id,
    actorEmail: user.email,
  });

  revalidateEmployeePaths();
  return { ok: true as const };
}

export async function getTaskSubmitChecklistAction(taskId: string) {
  const user = await requireUser();
  return buildTaskSubmitChecklist(user, taskId);
}
