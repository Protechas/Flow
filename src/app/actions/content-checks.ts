"use server";

import { eddyReviewContent, type EddyContentReview } from "@/lib/ai/content-review";
import { isAiEnabled, AI_DISABLED_MESSAGE } from "@/lib/ai/client";
import { normalizeRole } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

/** Same crowd that can open /tools — leads and up. */
const TOOL_ROLES = new Set(["admin", "super_admin", "senior_manager", "manager", "teamlead"]);

/**
 * Manual-start Eddy content review (owner's rule: free checks run themselves,
 * anything that costs money is a button). The document text arrives from the
 * client because extraction happens in the browser — the server never stores
 * it, it goes straight to the review call and is discarded.
 */
export async function eddyReviewContentAction(input: {
  fileName: string;
  claim: string;
  text: string;
  structuralNote?: string;
}): Promise<{ ok: true; review: EddyContentReview } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!TOOL_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, message: "Eddy reviews are available to leads and managers" };
  }
  if (!isAiEnabled()) {
    return { ok: false, message: AI_DISABLED_MESSAGE };
  }
  if (!input.fileName?.trim() || typeof input.text !== "string") {
    return { ok: false, message: "Nothing to review" };
  }

  try {
    const review = await eddyReviewContent({
      fileName: input.fileName,
      claim: input.claim || input.fileName,
      text: input.text,
      structuralNote: input.structuralNote,
      userId: user.id,
    });
    return { ok: true, review };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Eddy could not review this document" };
  }
}
