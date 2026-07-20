/**
 * "Your rules may be stale" nudge. When an SI SOP in the Knowledge Library is
 * updated after the content rules were last touched, the section list those
 * rules enforce may no longer match the SOP — surface a reminder in the Rule
 * Engine so someone re-checks. Pure so it can be unit-tested without a DB.
 */

/** Knowledge categories whose changes should prompt a rule review. */
export const SOP_RULE_CATEGORIES = ["si_content_sop", "si_library_sop"] as const;

/** Rules driven by SOP content — the ones a stale SOP would invalidate. */
export const SOP_DRIVEN_RULE_KEYS = ["required_sections"] as const;

export interface SopFreshnessInput {
  /** Newest updated_at across SOP-driving knowledge entries, or null if none. */
  latestSopUpdatedAt: string | null;
  /** Newest updated_at across the SOP-driven rules, or null if none. */
  latestRuleUpdatedAt: string | null;
  /** Title of the most recently updated SOP, for the message. */
  latestSopTitle?: string | null;
}

export interface SopFreshnessNudge {
  stale: boolean;
  sopUpdatedAt: string | null;
  sopTitle: string | null;
  message: string | null;
}

export function evaluateSopFreshness(input: SopFreshnessInput): SopFreshnessNudge {
  const { latestSopUpdatedAt, latestRuleUpdatedAt, latestSopTitle } = input;

  if (!latestSopUpdatedAt) {
    return { stale: false, sopUpdatedAt: null, sopTitle: null, message: null };
  }

  const sopTime = Date.parse(latestSopUpdatedAt);
  const ruleTime = latestRuleUpdatedAt ? Date.parse(latestRuleUpdatedAt) : 0;
  const stale = Number.isFinite(sopTime) && sopTime > ruleTime;

  const title = latestSopTitle?.trim() || "An SI SOP";
  return {
    stale,
    sopUpdatedAt: latestSopUpdatedAt,
    sopTitle: latestSopTitle?.trim() || null,
    message: stale
      ? `${title} was updated after these rules were last reviewed. Check that the required-section rules still match the SOP.`
      : null,
  };
}
