"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getDailyWrapUpById, updateDailyWrapUpReview } from "@/lib/data/flow-store";
import { persistDailyWrapUpSync } from "@/lib/data/wrap-ups-db";
import { ensureServerWriteContext } from "@/lib/server/write-context";
import { canViewWrapUp } from "@/lib/wrap-up/review";

function revalidateWrapUpReviewPaths() {
  revalidatePath("/wrap-ups");
  revalidatePath("/executive");
}

export async function markWrapUpReviewedAction(
  wrapUpId: string,
  internalNotes?: string
) {
  const actor = await requireUser();
  if (
    !hasPermission(actor.role, "work:view_all") &&
    !hasPermission(actor.role, "people:view_team")
  ) {
    throw new Error("FORBIDDEN");
  }

  await ensureServerWriteContext();
  const wrapUp = getDailyWrapUpById(wrapUpId);
  if (!wrapUp || !canViewWrapUp(actor, wrapUp)) throw new Error("FORBIDDEN");

  const now = new Date().toISOString();
  const saved = updateDailyWrapUpReview(wrapUpId, {
    reviewed_at: now,
    reviewed_by: actor.id,
    internal_notes: internalNotes?.trim() || wrapUp.internal_notes,
  });
  if (!saved) throw new Error("Wrap-up not found");
  await persistDailyWrapUpSync(saved);

  await writeAuditLog({
    action: "status_changed",
    entityType: "daily_wrap_up",
    entityId: wrapUpId,
    summary: `Wrap-up reviewed for ${wrapUp.wrap_date}`,
    metadata: { reviewed_by: actor.id },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateWrapUpReviewPaths();
  return { ok: true as const };
}

export async function updateWrapUpReviewNotesAction(wrapUpId: string, internalNotes: string) {
  const actor = await requireUser();
  if (
    !hasPermission(actor.role, "work:view_all") &&
    !hasPermission(actor.role, "people:view_team")
  ) {
    throw new Error("FORBIDDEN");
  }

  await ensureServerWriteContext();
  const wrapUp = getDailyWrapUpById(wrapUpId);
  if (!wrapUp || !canViewWrapUp(actor, wrapUp)) throw new Error("FORBIDDEN");

  const saved = updateDailyWrapUpReview(wrapUpId, {
    internal_notes: internalNotes.trim() || null,
  });
  if (!saved) throw new Error("Wrap-up not found");
  await persistDailyWrapUpSync(saved);
  revalidateWrapUpReviewPaths();
  return { ok: true as const };
}

export async function flagWrapUpFollowUpAction(
  wrapUpId: string,
  followUpNeeded: boolean,
  followUpNotes?: string
) {
  const actor = await requireUser();
  if (
    !hasPermission(actor.role, "work:view_all") &&
    !hasPermission(actor.role, "people:view_team")
  ) {
    throw new Error("FORBIDDEN");
  }

  await ensureServerWriteContext();
  const wrapUp = getDailyWrapUpById(wrapUpId);
  if (!wrapUp || !canViewWrapUp(actor, wrapUp)) throw new Error("FORBIDDEN");

  const saved = updateDailyWrapUpReview(wrapUpId, {
    follow_up_needed: followUpNeeded,
    follow_up_notes: followUpNotes?.trim() || null,
  });
  if (!saved) throw new Error("Wrap-up not found");
  await persistDailyWrapUpSync(saved);

  await writeAuditLog({
    action: "status_changed",
    entityType: "daily_wrap_up",
    entityId: wrapUpId,
    summary: followUpNeeded
      ? `Follow-up flagged on wrap-up`
      : `Follow-up cleared on wrap-up`,
    metadata: { follow_up_needed: followUpNeeded },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateWrapUpReviewPaths();
  return { ok: true as const };
}
