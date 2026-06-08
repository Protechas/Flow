"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { submitQaReviewApi } from "@/lib/data/qa";
import type { QaResult } from "@/types/flow";

const PATHS = [
  "/operations",
  "/executive",
  "/people",
  "/project-health",
  "/qa-center",
  "/reports",
];

export async function submitQaReviewAction(params: {
  workPackageId: string;
  reviewerId: string;
  analystId: string;
  result: QaResult;
  notes?: string;
  errorCategory?: string;
}) {
  await requirePermission("qa:review");
  await submitQaReviewApi(params);
  await writeAuditLog({
    action: "qa_decision",
    entityType: "work_package",
    entityId: params.workPackageId,
    summary: `QA ${params.result} on package`,
    metadata: { result: params.result, analyst_id: params.analystId },
  });
  PATHS.forEach((p) => revalidatePath(p));
}
