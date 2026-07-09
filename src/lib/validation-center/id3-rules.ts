import { randomUUID } from "node:crypto";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** A rule row Mark maintains in the UI — arbitrary column/value pairs that
 * mirror the manufacturer chart's columns. */
export interface Id3Rule {
  id: string;
  fields: Record<string, string>;
  notes: string | null;
  updated_at: string;
}

const memoryRules: Id3Rule[] = [];

function admin() {
  return isSupabaseConfigured() && isAdminConfigured() ? createAdminClient() : null;
}

export async function listId3Rules(): Promise<Id3Rule[]> {
  const db = admin();
  if (!db) return [...memoryRules];
  const { data, error } = await db
    .from("id3_rules")
    .select("id, fields, notes, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    fields: (r.fields ?? {}) as Record<string, string>,
    notes: r.notes != null ? String(r.notes) : null,
    updated_at: String(r.updated_at),
  }));
}

export async function addId3Rule(
  fields: Record<string, string>,
  notes: string | null,
  updatedBy: string
): Promise<Id3Rule> {
  const rule: Id3Rule = {
    id: randomUUID(),
    fields,
    notes,
    updated_at: new Date().toISOString(),
  };
  const db = admin();
  if (!db) {
    memoryRules.push(rule);
    return rule;
  }
  const { error } = await db.from("id3_rules").insert({
    id: rule.id,
    fields,
    notes,
    updated_by: updatedBy,
  });
  if (error) throw new Error(error.message);
  return rule;
}

export async function updateId3Rule(
  id: string,
  fields: Record<string, string>,
  notes: string | null,
  updatedBy: string
): Promise<void> {
  const db = admin();
  if (!db) {
    const idx = memoryRules.findIndex((r) => r.id === id);
    if (idx >= 0) memoryRules[idx] = { ...memoryRules[idx], fields, notes };
    return;
  }
  const { error } = await db
    .from("id3_rules")
    .update({ fields, notes, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteId3Rule(id: string): Promise<void> {
  const db = admin();
  if (!db) {
    const idx = memoryRules.findIndex((r) => r.id === id);
    if (idx >= 0) memoryRules.splice(idx, 1);
    return;
  }
  const { error } = await db.from("id3_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
