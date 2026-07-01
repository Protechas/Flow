import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { ensureProductionTrackingHydrated } from "@/lib/data/production-tracking-db";
import { ensureWrapUpsHydrated } from "@/lib/data/wrap-ups-db";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Load org + production + wrap-up data before mutating in-memory store on Supabase. */
export async function ensureServerWriteContext(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await ensureAppDataLoaded();
  await ensureProductionTrackingHydrated();
  await ensureWrapUpsHydrated();
}
