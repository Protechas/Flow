import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { asDbUserId } from "@/lib/ai/triage-db";

/**
 * Per-call AI metering (security rule #5). Best-effort: a logging failure must
 * never break the feature that made the call.
 */
export interface AiUsageEntry {
  /** Stable feature slug, e.g. "findings_triage", "ask_flow". */
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  userId?: string | null;
  /** Optional reference to the record analyzed, e.g. a validation run id. */
  runRef?: string | null;
}

function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/** $ per million tokens, matched by substring of the model id. */
const MODEL_PRICING: { match: string; input: number; output: number }[] = [
  { match: "haiku", input: 1, output: 5 },
  { match: "sonnet", input: 3, output: 15 },
  { match: "opus", input: 15, output: 75 },
];

function costFor(model: string, inputTokens: number, outputTokens: number): number {
  const p =
    MODEL_PRICING.find((m) => model.toLowerCase().includes(m.match)) ??
    MODEL_PRICING[0];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/**
 * Conservative minutes-of-manual-work-replaced per call, by feature.
 * Assumptions, not measurements — the ROI panel labels them as such.
 */
const MINUTES_SAVED_PER_CALL: Record<string, number> = {
  content_review: 10,
  content_model_report: 15,
  sop_review: 20,
  findings_triage: 5,
  content_audit_tasks: 5,
};
const DEFAULT_MINUTES_SAVED = 2;

export interface AiUsageFeatureRow {
  feature: string;
  calls: number;
  spend: number;
  minutesSaved: number;
}

export interface AiUsageSummary {
  totalCalls: number;
  totalSpend: number;
  totalMinutesSaved: number;
  byFeature: AiUsageFeatureRow[];
}

export async function summarizeAiUsage(): Promise<AiUsageSummary | null> {
  try {
    if (!isDbConfigured()) return null;
    const client = isAdminConfigured() ? createAdminClient() : await createClient();
    const { data, error } = await client
      .from("ai_usage_log")
      .select("feature, model, input_tokens, output_tokens");
    if (error || !data) return null;

    const byFeature = new Map<string, AiUsageFeatureRow>();
    for (const row of data) {
      const feature = String(row.feature ?? "other");
      const entry =
        byFeature.get(feature) ?? { feature, calls: 0, spend: 0, minutesSaved: 0 };
      entry.calls += 1;
      entry.spend += costFor(
        String(row.model ?? ""),
        Number(row.input_tokens ?? 0),
        Number(row.output_tokens ?? 0)
      );
      entry.minutesSaved += MINUTES_SAVED_PER_CALL[feature] ?? DEFAULT_MINUTES_SAVED;
      byFeature.set(feature, entry);
    }

    const rows = [...byFeature.values()].sort((a, b) => b.calls - a.calls);
    return {
      totalCalls: rows.reduce((s, r) => s + r.calls, 0),
      totalSpend: rows.reduce((s, r) => s + r.spend, 0),
      totalMinutesSaved: rows.reduce((s, r) => s + r.minutesSaved, 0),
      byFeature: rows,
    };
  } catch {
    return null;
  }
}

export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    if (!isDbConfigured()) {
      console.info(
        `[ai] usage feature=${entry.feature} model=${entry.model} in=${entry.inputTokens} out=${entry.outputTokens}`
      );
      return;
    }
    const client = isAdminConfigured() ? createAdminClient() : await createClient();
    await client.from("ai_usage_log").insert({
      feature: entry.feature,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      user_id: asDbUserId(entry.userId),
      run_ref: entry.runRef ?? null,
    });
  } catch (e) {
    console.error("[ai] usage log failed", e instanceof Error ? e.message : e);
  }
}
