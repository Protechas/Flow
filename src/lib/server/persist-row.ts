import {
  assertPersistedUuid,
  isPersistedUuid,
  persistedUuidOrNull,
} from "@/lib/server/persisted-id";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

/**
 * Validate UUID-shaped fields before Supabase upsert.
 * Catches demo/mock ids (clk-*, dept-service-info) before they become 500s in production.
 */
export function assertPersistRow(
  table: string,
  row: Row,
  requiredUuidFields: string[],
  optionalUuidFields: string[] = []
): void {
  if (!isSupabaseConfigured()) return;

  for (const field of requiredUuidFields) {
    const value = row[field];
    try {
      assertPersistedUuid(typeof value === "string" ? value : null, `${table}.${field}`);
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : `Invalid ${table}.${field} for Supabase persist`
      );
    }
  }

  for (const field of optionalUuidFields) {
    const value = row[field];
    if (value == null || value === "") continue;
    if (!isPersistedUuid(String(value))) {
      throw new Error(
        `PERSIST_ID_INVALID: ${table}.${field} must be a UUID or null before saving to Supabase (got ${String(value)}).`
      );
    }
  }
}

/** Normalize optional FK UUID columns — null when value is a demo/mock string. */
export function normalizePersistRowUuids(row: Row, optionalUuidFields: string[]): Row {
  const out = { ...row };
  for (const field of optionalUuidFields) {
    if (field in out) {
      out[field] = persistedUuidOrNull(out[field] as string | null | undefined);
    }
  }
  return out;
}
