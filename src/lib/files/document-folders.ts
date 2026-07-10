import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type { DocumentFolder } from "@/types/flow";

let memoryFolders: DocumentFolder[] = [];

function ts() {
  return new Date().toISOString();
}

function mapRow(row: Record<string, unknown>): DocumentFolder {
  return {
    id: String(row.id),
    name: String(row.name),
    parent_id: row.parent_id != null ? String(row.parent_id) : null,
    sort_order: Number(row.sort_order ?? 0),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listDocumentFolders(): Promise<DocumentFolder[]> {
  if (!isSupabaseConfigured()) {
    return [...memoryFolders].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_folders")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createDocumentFolder(input: {
  name: string;
  parent_id: string | null;
  created_by: string;
}): Promise<DocumentFolder> {
  const name = input.name.trim();
  if (!name) throw new Error("Folder name is required");

  if (!isSupabaseConfigured()) {
    const folder: DocumentFolder = {
      id: randomUUID(),
      name,
      parent_id: input.parent_id,
      sort_order: 0,
      created_by: input.created_by,
      created_at: ts(),
      updated_at: ts(),
    };
    memoryFolders = [...memoryFolders, folder];
    return folder;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_folders")
    .insert({ name, parent_id: input.parent_id, created_by: input.created_by })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function renameDocumentFolder(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");

  if (!isSupabaseConfigured()) {
    memoryFolders = memoryFolders.map((f) =>
      f.id === id ? { ...f, name: trimmed, updated_at: ts() } : f
    );
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_folders")
    .update({ name: trimmed, updated_at: ts() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Documents inside keep existing (folder_id becomes NULL → they surface at root). */
export async function deleteDocumentFolder(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryFolders = memoryFolders.filter((f) => f.id !== id && f.parent_id !== id);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("document_folders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
