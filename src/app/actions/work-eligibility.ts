"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  getWorkEligibility,
  grantWorkEligibilityOverride,
  getActiveWorkEligibilityOverride,
  getRecentBlockedAttempts,
} from "@/lib/work-eligibility";
import { assertCanManageEmployeeEligibility } from "@/lib/work-eligibility/scope";

export async function getWorkEligibilityAction() {
  const user = await requireUser();
  return getWorkEligibility(user);
}

export async function grantWorkEligibilityOverrideAction(input: {
  employeeId: string;
  reason: string;
  durationMinutes?: number;
}) {
  const manager = await requirePermission("work:assign");
  if (!input.reason.trim()) {
    throw new Error("Override reason is required");
  }
  assertCanManageEmployeeEligibility(manager, input.employeeId);

  const override = grantWorkEligibilityOverride({
    employeeId: input.employeeId,
    grantedBy: manager.id,
    reason: input.reason,
    durationMinutes: input.durationMinutes,
  });

  await writeAuditLog({
    action: "workflow_alert",
    entityType: "work_eligibility",
    entityId: input.employeeId,
    summary: `Work eligibility override granted for employee`,
    metadata: {
      event: "work_eligibility_override_granted",
      reason: input.reason,
      expires_at: override.expires_at,
      granted_by: manager.id,
    },
    actorId: manager.id,
    actorEmail: manager.email,
  });

  revalidatePath("/work");
  return { ok: true as const, expiresAt: override.expires_at };
}

export async function getWorkEligibilityOverrideAction(employeeId: string) {
  const manager = await requirePermission("work:assign");
  assertCanManageEmployeeEligibility(manager, employeeId);
  return getActiveWorkEligibilityOverride(employeeId);
}

export async function getRecentWorkEligibilityBlocksAction(employeeId: string) {
  const viewer = await requirePermission("work:view_team");
  assertCanManageEmployeeEligibility(viewer, employeeId);
  return getRecentBlockedAttempts(employeeId);
}
