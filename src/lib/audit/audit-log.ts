import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuditLogEntry, AuditAction } from "@/types/flow";

const demoAuditLog: AuditLogEntry[] = [];

export async function writeAuditLog(params: {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorEmail?: string;
}): Promise<void> {
  const actor = params.actorId
    ? { id: params.actorId, email: params.actorEmail ?? "" }
    : await getCurrentUser().catch(() => null);

  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor_id: actor?.id ?? null,
    actor_email: actor?.email ?? params.actorEmail ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    summary: params.summary,
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    demoAuditLog.unshift(entry);
    if (demoAuditLog.length > 500) demoAuditLog.pop();
    return;
  }

  const row = {
    actor_id: entry.actor_id,
    actor_email: entry.actor_email,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    summary: entry.summary,
    metadata: entry.metadata,
  };

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert(row);
    if (error) console.warn("[audit_log] insert failed:", error.message);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audit_log").insert(row);
  if (error) console.warn("[audit_log] insert failed:", error.message);
}

export async function listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  if (!isSupabaseConfigured()) {
    return demoAuditLog.slice(0, limit);
  }

  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const { data, error } = await client
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AuditLogEntry[];
}
