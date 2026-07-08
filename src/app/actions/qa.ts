"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { submitQaReviewApi } from "@/lib/data/qa";
import {
  getLatestSubmission,
  recordProductionQaReview,
  resolveBatchSubmission,
} from "@/lib/data/production-tracking";
import {
  persistQaReviewRecordSync,
  persistTaskSubmissionSync,
} from "@/lib/data/production-tracking-db";
import { persistPackageState } from "@/lib/production/persist-helpers";
import { ensureServerWriteContext } from "@/lib/server/write-context";
import type { QaResult } from "@/types/flow";

const PATHS = [
  "/operations",
  "/executive",
  "/people",
  "/project-health",
  "/qa-center",
  "/reports",
  "/production",
  "/work",
  "/validation/findings",
  "/validation/corrections",
];

export async function submitQaReviewAction(params: {
  workPackageId: string;
  reviewerId: string;
  analystId: string;
  result: QaResult;
  notes?: string;
  errorCategory?: string;
}) {
  const actor = await requirePermission("qa:review");
  await ensureServerWriteContext();
  await submitQaReviewApi({
    ...params,
    reviewerId: actor.id,
  });
  const submission = getLatestSubmission(params.workPackageId);
  const review = recordProductionQaReview({
    task_id: params.workPackageId,
    submission_id: submission?.id ?? null,
    reviewer_id: actor.id,
    result: params.result,
    notes: params.notes,
    error_category: params.errorCategory,
  });
  await persistQaReviewRecordSync(review);
  await writeAuditLog({
    action: "qa_decision",
    entityType: "work_package",
    entityId: params.workPackageId,
    summary: `QA ${params.result} on package`,
    metadata: { result: params.result, analyst_id: params.analystId },
  });

  const { syncValidationFindingFromWorkPackage } = await import(
    "@/lib/validation-center/task-bridge"
  );
  await syncValidationFindingFromWorkPackage(
    params.workPackageId,
    params.result === "pass" ? "qa_pass" : "qa_fail",
    params.result
  );

  PATHS.forEach((p) => revalidatePath(p));
}

export async function requestFileReuploadAction(taskId: string) {
  const actor = await requirePermission("qa:review");
  await ensureServerWriteContext();
  try {
    const { getFlowStore } = await import("@/lib/data/flow-store");
    const pkg = getFlowStore().workPackages.find((p) => p.id === taskId);
    if (!pkg) return { ok: false as const, message: "Task not found" };
    if (!pkg.assigned_to) {
      return { ok: false as const, message: "Task has no assigned analyst to notify" };
    }
    const { deliverNotification } = await import("@/lib/notifications/notifications");
    deliverNotification({
      user_id: pkg.assigned_to,
      type: "correction_issued",
      title: "Re-upload needed for QA review",
      message: `${actor.full_name} needs the files on ${pkg.title} re-uploaded — the originals were saved before file storage was enabled and can't be opened.`,
      related_entity_type: "work_package",
      related_entity_id: taskId,
      link: `/work/${taskId}`,
    });
    await writeAuditLog({
      action: "status_changed",
      entityType: "work_package",
      entityId: taskId,
      summary: `Reviewer requested file re-upload on ${pkg.title}`,
      metadata: { analyst_id: pkg.assigned_to },
      actorId: actor.id,
      actorEmail: actor.email,
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function reviewBatchSubmissionAction(params: {
  submissionId: string;
  result: "pass" | "correction";
  notes?: string;
}) {
  const actor = await requirePermission("qa:review");
  await ensureServerWriteContext();
  try {
    const decision = params.result === "pass" ? "approved" : "correction_requested";
    const updated = resolveBatchSubmission(params.submissionId, decision, params.notes);
    await persistTaskSubmissionSync(updated);

    const review = recordProductionQaReview({
      task_id: updated.task_id,
      submission_id: updated.id,
      reviewer_id: actor.id,
      result: params.result === "pass" ? "pass" : "minor_correction",
      notes: params.notes,
    });
    await persistQaReviewRecordSync(review);
    // resolveBatchSubmission may flip the task status in memory (correction
    // flag on, or cleared by an approval) — persist it or it dies with this
    // lambda.
    await persistPackageState(updated.task_id);
    await writeAuditLog({
      action: "qa_decision",
      entityType: "task_submission",
      entityId: updated.id,
      summary: `Batch review ${params.result} (${updated.uploaded_file_count} files)`,
      metadata: { result: params.result, task_id: updated.task_id, analyst_id: updated.user_id },
    });
    PATHS.forEach((p) => revalidatePath(p));
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Batch review failed" };
  }
}
