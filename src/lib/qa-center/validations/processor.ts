import { ensureReferenceDocumentsLoaded } from "@/lib/qa-center/knowledge/store";
import {
  computeQaScore,
  hydrateValidationRules,
  runDeterministicValidationWithKnowledge,
  verdictFromScore,
} from "@/lib/qa-center/rules/engine";
import { runSmartReview } from "@/lib/qa-center/smart-review/engine";
import type { QaDocumentValidation } from "@/lib/qa-center/types";
import {
  getDocumentValidation,
  listDocumentValidations,
  updateDocumentValidation,
} from "@/lib/qa-center/validations/db";
import { readIntakeFile } from "@/lib/qa-center/validations/storage";

function estimateReviewMinutes(issueCount: number, score: number): number {
  if (issueCount === 0) return 5;
  if (score >= 85) return 10 + issueCount * 2;
  if (score >= 70) return 20 + issueCount * 3;
  return 30 + issueCount * 5;
}

export async function processDocumentValidation(validationId: string): Promise<QaDocumentValidation> {
  const doc = await getDocumentValidation(validationId);
  if (!doc) throw new Error("Validation not found");
  if (!doc.storage_path) throw new Error("No file stored for validation");

  await updateDocumentValidation(validationId, { status: "processing" });
  await Promise.all([hydrateValidationRules(), ensureReferenceDocumentsLoaded()]);

  try {
    const buffer = await readIntakeFile(doc.storage_path);
    const layerResults = await runDeterministicValidationWithKnowledge({
      file_name: doc.file_name,
      mime_type: doc.mime_type,
      file_size: doc.file_size ?? buffer.length,
      manufacturer: doc.manufacturer,
      file_buffer: buffer,
    });

    const { result: smartLayer, meta: smartMeta } = await runSmartReview(
      {
        file_name: doc.file_name,
        mime_type: doc.mime_type,
        file_size: doc.file_size ?? buffer.length,
        manufacturer: doc.manufacturer,
        file_buffer: buffer,
      },
      layerResults
    );

    const allLayerResults = [...layerResults, smartLayer];
    const issues = allLayerResults.flatMap((r) => r.issues);
    const qa_score = computeQaScore(allLayerResults);
    const verdict = verdictFromScore(qa_score, issues);
    const confidence_pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (smartLayer.score * 0.4 + qa_score * 0.6) -
            issues.filter((i) => i.severity === "critical").length * 8
        )
      )
    );

    const updated = await updateDocumentValidation(validationId, {
      status: "completed",
      qa_score,
      confidence_pct,
      verdict,
      estimated_review_minutes: estimateReviewMinutes(issues.length, qa_score),
      layer_results: { layers: allLayerResults, smart_review: smartMeta },
      ai_review: smartMeta as unknown as Record<string, unknown>,
      issues,
      completed_at: new Date().toISOString(),
    });

    if (!updated) throw new Error("Failed to save validation results");
    return updated;
  } catch (err) {
    await updateDocumentValidation(validationId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      ai_review: { error: err instanceof Error ? err.message : "Processing failed" },
    });
    throw err;
  }
}

export async function processDocumentValidationBatch(validationIds: string[]): Promise<number> {
  let processed = 0;
  for (const id of validationIds) {
    try {
      await processDocumentValidation(id);
      processed += 1;
    } catch {
      // continue batch
    }
  }
  return processed;
}

export async function processPendingDocumentValidations(limit = 20): Promise<number> {
  const pending = await listDocumentValidations(500);
  const ids = pending
    .filter((v) => v.status === "queued")
    .map((v) => v.id)
    .slice(0, limit);
  if (ids.length === 0) return 0;
  return processDocumentValidationBatch(ids);
}
