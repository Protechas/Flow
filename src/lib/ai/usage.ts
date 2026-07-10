import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

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
      user_id: entry.userId ?? null,
      run_ref: entry.runRef ?? null,
    });
  } catch (e) {
    console.error("[ai] usage log failed", e instanceof Error ? e.message : e);
  }
}
