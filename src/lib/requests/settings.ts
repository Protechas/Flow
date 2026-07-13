import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Request routing settings: which teams receive tickets. Empty = derive from
 * org structure (departments that own active projects).
 */

let memoryReceivingTeamIds: string[] = [];

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

export async function getReceivingTeamIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return memoryReceivingTeamIds;
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_settings")
    .select("receiving_team_ids")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Missing table (migration not applied) falls back to the derived rule.
    return [];
  }
  return Array.isArray(data?.receiving_team_ids) ? data.receiving_team_ids.map(String) : [];
}

export async function setReceivingTeamIds(teamIds: string[], updatedBy: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryReceivingTeamIds = [...teamIds];
    return;
  }
  const supabase = await dbClient();
  const { error } = await supabase.from("request_settings").upsert({
    id: 1,
    receiving_team_ids: teamIds,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
