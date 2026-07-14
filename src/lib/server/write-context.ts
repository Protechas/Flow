import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { invalidateHydration } from "@/lib/data/hydration-cache";
import { ensureProductionTrackingHydrated } from "@/lib/data/production-tracking-db";
import { ensureWrapUpsHydrated } from "@/lib/data/wrap-ups-db";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Load org + production + wrap-up data before mutating in-memory store on Supabase.
 *
 * Page reads may serve from the hydration cache, but writes validate state
 * machines against the store (active clock entry, running timer, wrap-up
 * gate) — those checks must never run on a cached snapshot, or an employee
 * whose last write landed on another server instance gets double entries or
 * a wrongful wrap-up block. Force both stores fresh before any write.
 */
export async function ensureServerWriteContext(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await ensureAppDataLoaded();
  invalidateHydration("production-tracking");
  invalidateHydration("wrap-ups");
  await ensureProductionTrackingHydrated();
  await ensureWrapUpsHydrated();
  // Fresh data in hand: close any shift or timer someone forgot overnight
  // before this write validates against it.
  const { runStaleTimeSweep } = await import("@/lib/time-clock/stale-sweep");
  runStaleTimeSweep();
}
