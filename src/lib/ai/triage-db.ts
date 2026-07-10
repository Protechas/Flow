import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isValidationDbEnabled } from "@/lib/validation-center/validation-persistence";
import type { AiTriageCluster, AiTriageResult } from "@/lib/ai/types";

/** Same client preference as the rest of the validation center. */
async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

/** Demo-mode user ids ("user-admin") aren't UUIDs — store NULL rather than fail. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function asDbUserId(id: string | null | undefined): string | null {
  return id && UUID_RE.test(id) ? id : null;
}

/** Demo-mode / no-DB fallback; also serves as a same-instance cache. */
const memoryTriage = new Map<string, AiTriageResult>();

function mapRow(row: Record<string, unknown>): AiTriageResult {
  return {
    id: String(row.id),
    validation_run_id: String(row.validation_run_id),
    status: String(row.status) as AiTriageResult["status"],
    model: String(row.model),
    summary: String(row.summary ?? ""),
    clusters: (row.clusters ?? []) as AiTriageCluster[],
    findings_analyzed: Number(row.findings_analyzed ?? 0),
    findings_total: Number(row.findings_total ?? 0),
    input_tokens: Number(row.input_tokens ?? 0),
    output_tokens: Number(row.output_tokens ?? 0),
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_by: String(row.created_by ?? ""),
    created_at: String(row.created_at),
  };
}

/** Latest triage pass for a run — one scoped single-row query, no hydration. */
export async function getTriageForRun(runId: string): Promise<AiTriageResult | null> {
  if (isValidationDbEnabled()) {
    const client = await dbClient();
    const { data, error } = await client
      .from("validation_ai_triage")
      .select("*")
      .eq("validation_run_id", runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[ai-triage] read failed", error.message);
      return memoryTriage.get(runId) ?? null;
    }
    return data ? mapRow(data as Record<string, unknown>) : null;
  }
  return memoryTriage.get(runId) ?? null;
}

export async function saveTriage(result: AiTriageResult): Promise<AiTriageResult> {
  memoryTriage.set(result.validation_run_id, result);
  if (!isValidationDbEnabled()) return result;

  const client = await dbClient();
  const { data, error } = await client
    .from("validation_ai_triage")
    .insert({
      validation_run_id: result.validation_run_id,
      status: result.status,
      model: result.model,
      summary: result.summary,
      clusters: result.clusters,
      findings_analyzed: result.findings_analyzed,
      findings_total: result.findings_total,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      error_message: result.error_message,
      created_by: asDbUserId(result.created_by),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[ai-triage] persist failed", error.message);
    return result;
  }
  const saved = mapRow(data as Record<string, unknown>);
  memoryTriage.set(saved.validation_run_id, saved);
  return saved;
}
