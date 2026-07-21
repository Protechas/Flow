import { cache } from "react";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAllTaskFileUploads } from "@/lib/data/production-tracking";

/** Minimal upload row for aggregate math — who uploaded, when. */
export interface UploadEvent {
  user_id: string;
  uploaded_at: string;
  created_at: string;
}

/**
 * Skinny full-history upload fetch for ROI/Then-vs-Now: three columns paged
 * past PostgREST's 1000-row cap (~60 bytes/row), instead of hauling every
 * full upload row through the production store on each hydration. Cached
 * per request; only the ROI page pays it.
 */
export const listUploadEventsSince = cache(async (sinceIso: string): Promise<UploadEvent[]> => {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    // Demo mode: the in-memory store holds everything there is.
    return getAllTaskFileUploads()
      .filter((u) => (u.uploaded_at ?? u.created_at) >= sinceIso)
      .map((u) => ({
        user_id: u.user_id,
        uploaded_at: u.uploaded_at ?? u.created_at,
        created_at: u.created_at,
      }));
  }

  const supabase = createAdminClient();
  const pageSize = 1000;
  const maxRows = 100_000;
  const rows: UploadEvent[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await supabase
      .from("task_file_uploads")
      .select("user_id, uploaded_at, created_at")
      .gte("uploaded_at", sinceIso)
      .order("uploaded_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      rows.push({
        user_id: String(r.user_id),
        uploaded_at: String(r.uploaded_at ?? r.created_at),
        created_at: String(r.created_at),
      });
    }
    if (!data || data.length < pageSize) break;
  }
  return rows;
});
