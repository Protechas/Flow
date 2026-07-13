"use server";

import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { isAiEnabled, AI_DISABLED_MESSAGE } from "@/lib/ai/client";
import { runSopReview } from "@/lib/ai/sop-review";
import type { AiSopReviewResult } from "@/lib/ai/types";
import { getCompanyDocumentById } from "@/lib/files/company-documents";
import { getEditableDocumentHtml, isDocumentEditable } from "@/lib/files/document-editing";

export interface AiSopReviewActionResult {
  ok: boolean;
  review: AiSopReviewResult | null;
  message?: string;
}

/** Explicit user action only — this is the one place document review spends API budget. */
export async function runSopReviewAction(documentId: string): Promise<AiSopReviewActionResult> {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false, review: null, message: "You do not have permission to review documents" };
  }
  if (!isAiEnabled()) {
    return { ok: false, review: null, message: AI_DISABLED_MESSAGE };
  }

  const doc = await getCompanyDocumentById(documentId);
  if (!doc) return { ok: false, review: null, message: "Document not found" };
  if (!isDocumentEditable(doc)) {
    return { ok: false, review: null, message: "This file type can't be reviewed in Flow" };
  }

  try {
    const content = await getEditableDocumentHtml(doc);
    if (!content?.html) {
      return { ok: false, review: null, message: "The document has no content to review yet" };
    }
    const review = await runSopReview(doc, content.html, user.id);
    return { ok: true, review };
  } catch (e) {
    console.error("[ai-sop-review] failed", e instanceof Error ? e.message : e);
    return {
      ok: false,
      review: null,
      message: e instanceof Error ? e.message : "Review failed — try again",
    };
  }
}
