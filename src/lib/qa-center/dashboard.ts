import { getQaQueue } from "@/lib/data/qa";
import { countActiveKnowledgeEntries, ensureReferenceDocumentsLoaded } from "@/lib/qa-center/knowledge/store";
import { countGoldStandards } from "@/lib/qa-center/gold-standards/db";
import { countQueuedValidations, getValidationStats, listDocumentValidations } from "@/lib/qa-center/validations/db";
import type { QaCenterDashboardStats } from "@/lib/qa-center/types";
import { getKnowledgeLibraryStatus } from "@/lib/qa-center/knowledge/status";
import { getValidationCenterKpis, listValidationRuns } from "@/lib/validation-center/runs";
import { listValidationFindings } from "@/lib/validation-center/findings";

export async function getQaCenterDashboardStats(
  branchIds: string[] | null
): Promise<QaCenterDashboardStats> {
  const [runs, kpis, reviewQueue, findings] = await Promise.all([
    listValidationRuns(),
    getValidationCenterKpis(),
    getQaQueue(branchIds ?? undefined),
    listValidationFindings(),
  ]);
  await ensureReferenceDocumentsLoaded();
  const [knowledgeEntries, goldStandards, uploadQueueCount, docStats, libraryStatus] =
    await Promise.all([
    countActiveKnowledgeEntries(),
    countGoldStandards(),
    countQueuedValidations(),
    getValidationStats(),
    getKnowledgeLibraryStatus(),
  ]);

  const completedDocs = await listDocumentValidations(500).then((all) =>
    all.filter((v) => v.status === "completed")
  );
  const reviewMinutes = completedDocs
    .map((v) => v.estimated_review_minutes)
    .filter((m): m is number => m != null);
  const averageReviewMinutes =
    reviewMinutes.length > 0
      ? Math.round((reviewMinutes.reduce((a, b) => a + b, 0) / reviewMinutes.length) * 10) / 10
      : null;

  const completed = runs.filter((r) => r.status === "completed");
  const openFindings = findings.filter(
    (f) => f.status !== "resolved" && f.status !== "dismissed"
  );
  const criticalFindings = openFindings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  );

  const complianceRates = completed
    .map((r) => r.compliance_rate)
    .filter((v): v is number => v != null);
  const averageQaScore =
    docStats.avgScore ??
    (complianceRates.length > 0
      ? Math.round(
          (complianceRates.reduce((s, v) => s + v, 0) / complianceRates.length) * 10
        ) / 10
      : null);

  return {
    filesSubmitted: docStats.total,
    preValidationPassed: docStats.passed,
    auditRunsSubmitted: runs.length,
    passed: docStats.passed + completed.filter((r) => (r.compliance_rate ?? 0) >= 85).length,
    warnings: docStats.warnings + openFindings.filter((f) => f.severity === "medium").length,
    failed: docStats.failed + openFindings.filter((f) => f.severity === "high").length,
    critical: docStats.critical + criticalFindings.length,
    averageQaScore,
    averageReviewMinutes,
    reviewQueueCount: reviewQueue.length,
    validationQueueCount: runs.filter((r) => r.status === "pending" || r.status === "processing")
      .length,
    uploadQueueCount: docStats.queued || uploadQueueCount,
    openFindings: openFindings.length,
    knowledgeEntries,
    goldStandards,
    libraryReady: libraryStatus.readyForValidation,
    libraryLoadedCount: libraryStatus.loadedWithFile,
    libraryTotalCount: libraryStatus.taxonomyTotal,
  };
}
