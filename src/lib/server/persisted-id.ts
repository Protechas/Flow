import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Postgres UUID v4 (RFC 4122) — required for Supabase primary/foreign keys. */
export const PERSISTED_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && PERSISTED_UUID_RE.test(value);
}

/**
 * IDs for rows written to Supabase must be UUIDs.
 * Demo/in-memory mode may use readable prefixed ids for debugging.
 */
export function newPersistedId(prefix = "row"): string {
  if (isSupabaseConfigured()) return randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function assertPersistedUuid(
  value: string | null | undefined,
  field: string
): asserts value is string {
  if (!isPersistedUuid(value)) {
    throw new Error(
      `PERSIST_ID_INVALID: ${field} must be a UUID before saving to Supabase (got ${value ?? "null"}).`
    );
  }
}

/** Drop mock/demo string refs (e.g. dept-service-info) when persisting to UUID columns. */
export function persistedUuidOrNull(value: string | null | undefined): string | null {
  return isPersistedUuid(value) ? value : null;
}
