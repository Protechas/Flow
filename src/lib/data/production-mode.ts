import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Production data mode: real Supabase auth + no in-memory demo seed.
 * Demo/mock records must never surface in reporting when this is true.
 */
export function isProductionDataMode(): boolean {
  return isSupabaseConfigured();
}

export function isDemoDataEnabled(): boolean {
  return !isProductionDataMode();
}
