/**
 * Flow AI foundation — the single gateway for every Claude API call in the app.
 *
 * House rules (full policy: docs/AI_SECURITY.md):
 * 1. Server-side only. The key is ANTHROPIC_API_KEY (never NEXT_PUBLIC_), so it
 *    cannot reach the client bundle.
 * 2. Features send allowlisted fields only — build payloads with pickFields
 *    (./allowlist), never by passing whole records.
 * 3. AI output is advisory: displayed for human review, never used to trigger
 *    writes or actions on its own.
 * 4. Calls run only on explicit user action — never on page load, never as
 *    background work.
 * 5. Every call is metered via logAiUsage (./usage).
 */

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Model tiers — every feature uses the CHEAPEST tier that does its job well
 * (house rule). Escalate a feature's tier only with evidence its output is
 * weak, never "just in case."
 */
export const AI_MODELS = {
  /** Simple tasks — grounded Q&A, short summaries, formatting. (~$1/$5 per MTok) */
  fast: "claude-haiku-4-5-20251001",
  /** Workhorse — triage, clustering, drafting over many records. (~$2-3/$15 per MTok) */
  standard: process.env.FLOW_AI_MODEL?.trim() || "claude-sonnet-5",
  /** Deep reasoning — rule compilation, complex one-off analysis. (~$5/$25 per MTok) */
  reasoning: "claude-opus-4-8",
} as const;

export const AI_DISABLED_MESSAGE =
  "AI features are not configured. Set ANTHROPIC_API_KEY to enable them.";

/** Returns an Anthropic client, or null when no key is configured. */
export async function getAiClient() {
  if (!isAiEnabled()) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic();
}
