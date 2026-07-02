"use server";

import { appTodayDate } from "@/lib/datetime/timezone";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { hasPermission } from "@/lib/auth/permissions";
import { teamLeadCanViewPerson } from "@/lib/auth/team-scope";
import { requireUser } from "@/lib/auth/session";
import {
  createWrapUpOverride,
  recordWrapUpBlockAttempt,
} from "@/lib/data/flow-store";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getUserById } from "@/lib/data/users";
import { persistWrapUpOverrideSync } from "@/lib/data/wrap-ups-db";
import { ensureServerWriteContext } from "@/lib/server/write-context";
import {
  canClockOutForDay,
  getWrapUpComplianceStatus,
} from "@/lib/wrap-up/compliance";

function revalidateWrapUpPaths() {
  revalidatePath("/work");
  revalidatePath("/time-clock");
}

export async function getWrapUpComplianceStatusAction(wrapDate?: string) {
  const user = await requireUser();
  const date = wrapDate ?? appTodayDate();
  return {
    status: getWrapUpComplianceStatus(user.id, date),
    canClockOut: canClockOutForDay(user.id, date),
  };
}

export async function recordWrapUpBlockAttemptAction() {
  const user = await requireUser();
  const date = appTodayDate();
  recordWrapUpBlockAttempt(user.id, date);
  await writeAuditLog({
    action: "status_changed",
    entityType: "daily_wrap_up",
    entityId: user.id,
    summary: `${user.full_name} blocked from clock-out — wrap-up missing`,
    metadata: { wrap_date: date, event: "clock_out_blocked" },
    actorId: user.id,
    actorEmail: user.email,
  });
  return { ok: true as const };
}

export async function overrideWrapUpRequirementAction(
  userId: string,
  reason: string,
  wrapDate?: string
) {
  const actor = await requireUser();
  const date = wrapDate ?? appTodayDate();
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Override reason is required");

  const canManageAll = hasPermission(actor.role, "work:view_all");
  const canManageTeam = hasPermission(actor.role, "people:view_team");

  if (!canManageAll && !canManageTeam) {
    throw new Error("FORBIDDEN");
  }

  initFlowStore();
  if (!canManageAll && !teamLeadCanViewPerson(actor, userId, getFlowStore().users)) {
    throw new Error("FORBIDDEN");
  }

  const target = await getUserById(userId);
  if (!target || target.role !== "employee") {
    throw new Error("Override applies to employees only");
  }

  await ensureServerWriteContext();
  const override = createWrapUpOverride({
    user_id: userId,
    wrap_date: date,
    reason: trimmed,
    overridden_by: actor.id,
  });
  await persistWrapUpOverrideSync(override);

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "daily_wrap_up",
    entityId: userId,
    summary: `Wrap-up requirement overridden for ${target.full_name}`,
    metadata: {
      wrap_date: date,
      reason: trimmed,
      overridden_by: actor.id,
    },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateWrapUpPaths();
  return { ok: true as const };
}
