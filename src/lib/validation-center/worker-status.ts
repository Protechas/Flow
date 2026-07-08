import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export interface AuditWorkerStatus {
  online: boolean;
  lastSeenAt: string | null;
  host: string | null;
}

/** Ticks arrive every ~20s; three missed ticks means the worker is down. */
const ONLINE_WINDOW_MS = 90_000;

export async function getAuditWorkerStatus(): Promise<AuditWorkerStatus> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    // Demo/local dev runs the engine in-process — treat as online.
    return { online: true, lastSeenAt: null, host: "local" };
  }
  const { data } = await createAdminClient()
    .from("validation_settings")
    .select("settings")
    .eq("engine_id", "audit_worker")
    .maybeSingle();
  const settings = (data?.settings ?? {}) as { last_seen_at?: string; host?: string };
  const lastSeenAt = settings.last_seen_at ?? null;
  const online =
    lastSeenAt != null && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
  return { online, lastSeenAt, host: settings.host ?? null };
}
