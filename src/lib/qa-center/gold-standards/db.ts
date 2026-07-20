import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";

const memoryGoldCount = 0;

export async function countGoldStandards(): Promise<number> {
  if (!isSupabaseConfigured()) {
    const { listKnowledgeEntries } = await import("@/lib/qa-center/knowledge/store");
    const entries = await listKnowledgeEntries();
    return entries.filter(
      (e) => e.category === "gold_standard" && e.active_version?.storage_path
    ).length;
  }
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("qa_gold_standards")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) {
    return memoryGoldCount;
  }
  return count ?? 0;
}

export async function listGoldStandards(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_gold_standards")
    .select("*")
    .eq("is_active", true)
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
