import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { ensureProjectsHydrated } from "@/lib/data/projects-db";
import { hydrateAppStore } from "@/lib/data/users";

const hydrateApp = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    return;
  }
  await hydrateAppStore();
  await ensureProjectsHydrated();
});

/**
 * Load Supabase-backed org data into the in-memory store once per request.
 * Call from guards, layouts, and server modules that read flow-store users/projects.
 */
export async function ensureAppDataLoaded(): Promise<void> {
  await hydrateApp();
}

/** Hydrate then return the flow store — preferred over bare initFlowStore() on server. */
export async function getReadyFlowStore() {
  await ensureAppDataLoaded();
  return getFlowStore();
}

/** @deprecated Use ensureAppDataLoaded — kept for existing imports */
export async function hydrateProductionAppStore(): Promise<void> {
  await ensureAppDataLoaded();
}
