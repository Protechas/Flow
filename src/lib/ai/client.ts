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

export const AI_MODELS = {
  /** Deep reasoning — rule authoring, complex one-off analysis. */
  reasoning: "claude-opus-4-8",
  /** Workhorse — triage, drafting, summarization over many records. */
  standard: process.env.FLOW_AI_MODEL?.trim() || "claude-sonnet-5",
} as const;

export const AI_DISABLED_MESSAGE =
  "AI features are not configured. Set ANTHROPIC_API_KEY to enable them.";

/** Returns an Anthropic client, or null when no key is configured. */
export async function getAiClient() {
  if (!isAiEnabled()) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic();
}
