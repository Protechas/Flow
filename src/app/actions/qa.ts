"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { submitQaReviewApi } from "@/lib/data/qa";
import {
  getLatestSubmission,
  recordProductionQaReview,
} from "@/lib/data/production-tracking";
import { persistQaReviewRecordSync } from "@/lib/data/production-tracking-db";
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
