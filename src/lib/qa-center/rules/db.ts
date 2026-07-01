import type { QaValidationRule } from "@/lib/qa-center/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { isQaCenterTableUnavailable } from "@/lib/qa-center/supabase-errors";

function mapRuleRow(row: Record<string, unknown>): QaValidationRule {
  return {
    id: String(row.id),
    rule_key: String(row.rule_key),
    layer: String(row.layer) as QaValidationRule["layer"],
    label: String(row.label),
    description: row.description ? String(row.description) : null,
    config: (row.config as Record<string, unknown>) ?? {},
    enabled: Boolean(row.enabled),
    weight: Number(row.weight ?? 1),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: String(row.updated_at),
  };
}

export async function loadRulesFromDb(): Promise<QaValidationRule[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_validation_rules")
    .select("*")
    .order("layer")
    .order("label");
  if (error) {
    if (isQaCenterTableUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapRuleRow(row));
}

export async function persistRuleUpdate(
  rule: QaValidationRule,
  updatedBy?: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("qa_validation_rules")
    .update({
      enabled: rule.enabled,
      weight: rule.weight,
      config: rule.config,
      label: rule.label,
      description: rule.description,
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("rule_key", rule.rule_key);
  if (error) {
    if (isQaCenterTableUnavailable(error)) return;
    throw new Error(error.message);
  }
}

export async function seedRulesToDb(
  rules: Omit<QaValidationRule, "id" | "updated_by" | "updated_at">[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  for (const rule of rules) {
    const { error } = await supabase.from("qa_validation_rules").upsert(
      {
        rule_key: rule.rule_key,
        layer: rule.layer,
        label: rule.label,
        description: rule.description,
        config: rule.config,
        enabled: rule.enabled,
        weight: rule.weight,
      },
      { onConflict: "rule_key" }
    );
    if (error) {
      if (isQaCenterTableUnavailable(error)) return;
      throw new Error(error.message);
    }
  }
}
