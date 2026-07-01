import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Notification, NotificationType } from "@/types/flow";

let demoNotifications: Notification[] = [];

function uid() {
  return `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string;
  related_entity_id: string;
  link?: string | null;
}

function mapRow(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: row.type as NotificationType,
    title: String(row.title),
    message: String(row.message ?? row.body ?? ""),
    related_entity_type: String(row.related_entity_type ?? "work_package"),
    related_entity_id: String(row.related_entity_id ?? ""),
    read_status: Boolean(row.read_status ?? row.read ?? false),
    link: row.link ? String(row.link) : null,
    created_at: String(row.created_at),
  };
}

export function createNotificationSync(input: CreateNotificationInput): Notification {
  const n: Notification = {
    id: uid(),
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    message: input.message,
    related_entity_type: input.related_entity_type,
    related_entity_id: input.related_entity_id,
    read_status: false,
    link: input.link ?? null,
    created_at: new Date().toISOString(),
  };
  demoNotifications.unshift(n);
  if (demoNotifications.length > 2000) demoNotifications.pop();
  return n;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  if (!isSupabaseConfigured()) {
    return createNotificationSync(input);
  }

  const row = {
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    body: input.message,
    message: input.message,
    related_entity_type: input.related_entity_type,
    related_entity_id: input.related_entity_id,
    link: input.link ?? null,
    read: false,
  };

  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const { data, error } = await client.from("notifications").insert(row).select().single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Dedupe + create — async, for server actions and awaited paths. */
export async function maybeCreateNotification(
  input: CreateNotificationInput,
  withinHours = 24,
  skipDedupe = false
): Promise<Notification | null> {
  if (
    !skipDedupe &&
    (await hasRecentNotificationAsync(
      input.user_id,
      input.type,
      input.related_entity_type,
      input.related_entity_id,
      withinHours
    ))
  ) {
    return null;
  }
  if (!isSupabaseConfigured()) {
    return createNotificationSync(input);
  }
  return createNotification(input);
}

/**
 * Deliver a notification from sync workflow code.
 * Demo: in-memory. Production: async Supabase insert (deduped).
 */
export function deliverNotification(
  input: CreateNotificationInput,
  withinHours = 24,
  skipDedupe = false
): void {
  if (!isSupabaseConfigured()) {
    if (
      !skipDedupe &&
      hasRecentNotification(
        input.user_id,
        input.type,
        input.related_entity_type,
        input.related_entity_id,
        withinHours
      )
    ) {
      return;
    }
    createNotificationSync(input);
    return;
  }
  void maybeCreateNotification(input, withinHours, skipDedupe).catch((err) =>
    console.error("[notifications] deliver failed", err)
  );
}

export function hasRecentNotification(
  userId: string,
  type: NotificationType,
  entityType: string,
  entityId: string,
  withinHours = 24
): boolean {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return demoNotifications.some(
    (n) =>
      n.user_id === userId &&
      n.type === type &&
      n.related_entity_type === entityType &&
      n.related_entity_id === entityId &&
      new Date(n.created_at).getTime() > cutoff
  );
}

export async function hasRecentNotificationAsync(
  userId: string,
  type: NotificationType,
  entityType: string,
  entityId: string,
  withinHours = 24
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return hasRecentNotification(userId, type, entityType, entityId, withinHours);
  }
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .eq("related_entity_type", entityType)
    .eq("related_entity_id", entityId)
    .gte("created_at", cutoff);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function listNotificationsForUser(
  userId: string,
  limit = 50
): Promise<Notification[]> {
  if (!isSupabaseConfigured()) {
    return demoNotifications.filter((n) => n.user_id === userId).slice(0, limit);
  }

  const client = await createClient();
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return demoNotifications.filter((n) => n.user_id === userId && !n.read_status).length;
  }

  const client = await createClient();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = demoNotifications.findIndex((n) => n.id === id && n.user_id === userId);
    if (idx >= 0) demoNotifications[idx] = { ...demoNotifications[idx], read_status: true };
    return;
  }

  const client = await createClient();
  await client.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoNotifications = demoNotifications.map((n) =>
      n.user_id === userId ? { ...n, read_status: true } : n
    );
    return;
  }

  const client = await createClient();
  await client.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export function getDemoNotifications(): Notification[] {
  return demoNotifications;
}
