import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { QA_KNOWLEDGE_TAXONOMY } from "@/lib/qa-center/knowledge/catalog";
import {
  indexKnowledgeDocument,
  mergeEntryIndexMetadata,
} from "@/lib/qa-center/knowledge/indexer";
import {
  importLocalKnowledgeFile,
  newKnowledgeVersionId,
  uploadKnowledgeFile,
} from "@/lib/qa-center/knowledge/storage";
import { resolveKnowledgeRelativePath } from "@/lib/qa-center/knowledge/paths";
import type {
  QaKnowledgeCategory,
  QaKnowledgeEntry,
  QaKnowledgeIndexMetadata,
  QaKnowledgeVersion,
} from "@/lib/qa-center/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import {
  isQaCenterTableUnavailable,
  qaCenterTablesMissingMessage,
} from "@/lib/qa-center/supabase-errors";

export type DbKnowledgeVersion = QaKnowledgeVersion & { file_data_base64?: string | null };

let memoryEntries: QaKnowledgeEntry[] = [];
let memoryVersions: DbKnowledgeVersion[] = [];
let memoryIndex: {
  id: string;
  entry_id: string;
  version_id: string | null;
  term: string;
  term_type: string;
}[] = [];
let taxonomySeeded = false;
let qaKnowledgeTablesUnavailable = false;

function ts() {
  return new Date().toISOString();
}

function parseIndexMetadata(raw: unknown): QaKnowledgeIndexMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as QaKnowledgeIndexMetadata;
}

function mapEntryRow(row: Record<string, unknown>): QaKnowledgeEntry {
  return {
    id: String(row.id),
    entry_key: row.entry_key ? String(row.entry_key) : null,
    category: String(row.category) as QaKnowledgeCategory,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    active_version_id: row.active_version_id ? String(row.active_version_id) : null,
    is_archived: Boolean(row.is_archived),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    index_metadata: parseIndexMetadata(row.index_metadata),
  };
}

function mapVersionRow(row: Record<string, unknown>): DbKnowledgeVersion {
  return {
    id: String(row.id),
    entry_id: String(row.entry_id),
    version_number: Number(row.version_number),
    file_name: row.file_name ? String(row.file_name) : null,
    storage_path: row.storage_path ? String(row.storage_path) : null,
    file_size: row.file_size != null ? Number(row.file_size) : null,
    mime_type: row.mime_type ? String(row.mime_type) : null,
    is_active: Boolean(row.is_active),
    change_notes: row.change_notes ? String(row.change_notes) : null,
    uploaded_by: row.uploaded_by ? String(row.uploaded_by) : null,
    uploaded_at: String(row.uploaded_at),
    index_metadata: parseIndexMetadata(row.index_metadata),
    file_data_base64: row.file_data_base64 ? String(row.file_data_base64) : null,
  };
}

function hydrateEntry(entry: QaKnowledgeEntry, versions: DbKnowledgeVersion[]): QaKnowledgeEntry {
  const active =
    versions.find((v) => v.id === entry.active_version_id && v.is_active) ??
    versions.find((v) => v.entry_id === entry.id && v.is_active) ??
    null;
  return { ...entry, active_version: active };
}

async function listKnowledgeEntriesRaw(): Promise<QaKnowledgeEntry[]> {
  if (!isSupabaseConfigured()) {
    return [...memoryEntries];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_knowledge_entries")
    .select("*")
    .eq("is_archived", false)
    .order("title");
  if (error) {
    if (isQaCenterTableUnavailable(error)) {
      qaKnowledgeTablesUnavailable = true;
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEntryRow(row));
}

async function listVersionsRaw(): Promise<DbKnowledgeVersion[]> {
  if (!isSupabaseConfigured()) {
    return [...memoryVersions];
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("qa_knowledge_versions").select("*");
  if (error) {
    if (isQaCenterTableUnavailable(error)) {
      qaKnowledgeTablesUnavailable = true;
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapVersionRow(row));
}

async function ensureTaxonomySeeded(): Promise<void> {
  if (taxonomySeeded || qaKnowledgeTablesUnavailable) return;
  taxonomySeeded = true;

  const existing = await listKnowledgeEntriesRaw();
  if (qaKnowledgeTablesUnavailable) return;
  const existingKeys = new Set(existing.map((e) => e.entry_key).filter(Boolean));

  for (const item of QA_KNOWLEDGE_TAXONOMY) {
    if (existingKeys.has(item.entryKey)) continue;
    await createKnowledgeEntry({
      entry_key: item.entryKey,
      category: item.category,
      title: item.title,
      description: item.description,
      tags: [item.category],
    });
  }
}

async function persistIndexTerms(input: {
  entryId: string;
  versionId: string;
  metadata: QaKnowledgeIndexMetadata;
}): Promise<void> {
  const terms: { term: string; term_type: string }[] = [];
  for (const m of input.metadata.manufacturers ?? []) {
    terms.push({ term: m.toLowerCase(), term_type: "manufacturer" });
  }
  for (const t of input.metadata.search_terms ?? []) {
    terms.push({ term: t.toLowerCase(), term_type: "general" });
  }

  if (!isSupabaseConfigured()) {
    memoryIndex = memoryIndex.filter((i) => i.version_id !== input.versionId);
    for (const { term, term_type } of terms) {
      memoryIndex.push({
        id: randomUUID(),
        entry_id: input.entryId,
        version_id: input.versionId,
        term,
        term_type,
      });
    }
    return;
  }

  const supabase = await createClient();
  await supabase.from("qa_knowledge_index").delete().eq("version_id", input.versionId);
  if (terms.length === 0) return;
  const { error } = await supabase.from("qa_knowledge_index").insert(
    terms.map(({ term, term_type }) => ({
      entry_id: input.entryId,
      version_id: input.versionId,
      term,
      term_type,
    }))
  );
  if (error) {
    if (isQaCenterTableUnavailable(error)) return;
    throw new Error(error.message);
  }
}

async function updateKnowledgeEntryRecord(
  entryId: string,
  updates: {
    active_version_id?: string | null;
    index_metadata?: QaKnowledgeIndexMetadata;
    tags?: string[];
    is_archived?: boolean;
  }
): Promise<void> {
  const patch = { ...updates, updated_at: ts() };

  if (!isSupabaseConfigured()) {
    memoryEntries = memoryEntries.map((e) => (e.id === entryId ? { ...e, ...patch } : e));
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("qa_knowledge_entries").update(patch).eq("id", entryId);
  if (error) {
    if (isQaCenterTableUnavailable(error)) return;
    throw new Error(error.message);
  }
}

async function deactivateVersionsForEntry(entryId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    for (const v of memoryVersions) {
      if (v.entry_id === entryId) v.is_active = false;
    }
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("qa_knowledge_versions")
    .update({ is_active: false })
    .eq("entry_id", entryId);
  if (error) {
    if (isQaCenterTableUnavailable(error)) return;
    throw new Error(error.message);
  }
}

export async function listKnowledgeEntries(): Promise<QaKnowledgeEntry[]> {
  await ensureTaxonomySeeded();
  const [entries, versions] = await Promise.all([listKnowledgeEntriesRaw(), listVersionsRaw()]);
  return entries.map((e) => hydrateEntry(e, versions)).sort((a, b) => a.title.localeCompare(b.title));
}

export async function getKnowledgeEntryById(entryId: string): Promise<QaKnowledgeEntry | null> {
  const entries = await listKnowledgeEntries();
  return entries.find((e) => e.id === entryId) ?? null;
}

export async function getKnowledgeEntryByKey(entryKey: string): Promise<QaKnowledgeEntry | null> {
  const entries = await listKnowledgeEntries();
  return entries.find((e) => e.entry_key === entryKey) ?? null;
}

export async function getKnowledgeVersionById(
  versionId: string
): Promise<DbKnowledgeVersion | null> {
  const versions = await listVersionsRaw();
  return versions.find((v) => v.id === versionId) ?? null;
}

export async function listKnowledgeVersions(entryId: string): Promise<QaKnowledgeVersion[]> {
  const versions = await listVersionsRaw();
  return versions
    .filter((v) => v.entry_id === entryId)
    .sort((a, b) => b.version_number - a.version_number);
}

export async function createKnowledgeEntry(input: {
  entry_key?: string | null;
  category: QaKnowledgeCategory;
  title: string;
  description?: string | null;
  tags?: string[];
  created_by?: string | null;
}): Promise<QaKnowledgeEntry> {
  const id = randomUUID();
  const now = ts();
  const row = {
    id,
    entry_key: input.entry_key ?? null,
    category: input.category,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    tags: input.tags ?? [input.category],
    active_version_id: null,
    is_archived: false,
    created_by: input.created_by ?? null,
    created_at: now,
    updated_at: now,
    index_metadata: {},
  };

  if (!isSupabaseConfigured()) {
    memoryEntries.push(mapEntryRow(row));
    return hydrateEntry(mapEntryRow(row), memoryVersions);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("qa_knowledge_entries").insert(row).select("*").single();
  if (error) {
    if (isQaCenterTableUnavailable(error)) throw new Error(qaCenterTablesMissingMessage());
    throw new Error(error.message);
  }
  return hydrateEntry(mapEntryRow(data), await listVersionsRaw());
}

export async function uploadKnowledgeVersion(input: {
  entry_id: string;
  file_name: string;
  mime_type: string;
  buffer: Buffer;
  change_notes?: string | null;
  uploaded_by?: string | null;
  set_active?: boolean;
  category: QaKnowledgeCategory;
}): Promise<QaKnowledgeVersion> {
  const entry = await getKnowledgeEntryById(input.entry_id);
  if (!entry) throw new Error("Knowledge entry not found");

  const versionId = newKnowledgeVersionId();
  const uploaded = await uploadKnowledgeFile({
    entryId: input.entry_id,
    versionId,
    fileName: input.file_name,
    mimeType: input.mime_type,
    buffer: input.buffer,
  });

  const index_metadata = indexKnowledgeDocument({
    buffer: input.buffer,
    fileName: input.file_name,
    category: input.category,
  });

  const existingVersions = await listKnowledgeVersions(input.entry_id);
  const version_number =
    existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version_number)) + 1 : 1;

  const setActive = input.set_active !== false;
  if (setActive) {
    await deactivateVersionsForEntry(input.entry_id);
  }

  const versionRow = {
    id: versionId,
    entry_id: input.entry_id,
    version_number,
    file_name: input.file_name,
    storage_path: uploaded.storagePath,
    file_size: input.buffer.length,
    mime_type: input.mime_type,
    is_active: setActive,
    change_notes: input.change_notes ?? null,
    uploaded_by: input.uploaded_by ?? null,
    uploaded_at: ts(),
    index_metadata,
    file_data_base64: uploaded.fileDataBase64,
  };

  if (!isSupabaseConfigured()) {
    memoryVersions.push(mapVersionRow(versionRow));
  } else {
    const supabase = await createClient();
    const { error } = await supabase.from("qa_knowledge_versions").insert({
      id: versionId,
      entry_id: input.entry_id,
      version_number,
      file_name: input.file_name,
      storage_path: uploaded.storagePath,
      file_size: input.buffer.length,
      mime_type: input.mime_type,
      is_active: setActive,
      change_notes: input.change_notes ?? null,
      uploaded_by: input.uploaded_by ?? null,
      index_metadata,
    });
    if (error) throw new Error(error.message);
  }

  const mergedMeta = mergeEntryIndexMetadata(entry.index_metadata, index_metadata);
  const tags = [
    ...new Set([
      ...entry.tags,
      ...(index_metadata.manufacturers?.map((m) => m.toLowerCase()) ?? []),
    ]),
  ];

  await updateKnowledgeEntryRecord(input.entry_id, {
    active_version_id: setActive ? versionId : entry.active_version_id,
    index_metadata: mergedMeta,
    tags,
  });

  await persistIndexTerms({
    entryId: input.entry_id,
    versionId,
    metadata: index_metadata,
  });

  return mapVersionRow(versionRow);
}

export async function setActiveKnowledgeVersion(versionId: string): Promise<QaKnowledgeVersion | null> {
  const versions = await listVersionsRaw();
  const version = versions.find((v) => v.id === versionId);
  if (!version) return null;

  await deactivateVersionsForEntry(version.entry_id);

  if (!isSupabaseConfigured()) {
    memoryVersions = memoryVersions.map((v) =>
      v.entry_id === version.entry_id ? { ...v, is_active: v.id === versionId } : v
    );
  } else {
    const supabase = await createClient();
    const { error } = await supabase
      .from("qa_knowledge_versions")
      .update({ is_active: true })
      .eq("id", versionId);
    if (error) throw new Error(error.message);
  }

  await updateKnowledgeEntryRecord(version.entry_id, { active_version_id: versionId });
  return (await getKnowledgeVersionById(versionId)) as QaKnowledgeVersion;
}

export async function archiveKnowledgeEntry(entryId: string): Promise<boolean> {
  const entry = await getKnowledgeEntryById(entryId);
  if (!entry) return false;
  await updateKnowledgeEntryRecord(entryId, { is_archived: true });
  return true;
}

export async function countActiveKnowledgeEntries(): Promise<number> {
  const entries = await listKnowledgeEntries();
  return entries.filter((e) => e.active_version?.storage_path).length;
}

export async function searchKnowledgeEntries(query: string): Promise<QaKnowledgeEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listKnowledgeEntries();
  const entries = await listKnowledgeEntries();
  return entries.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q) ||
      (e.entry_key ?? "").toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)) ||
      (e.index_metadata?.manufacturers ?? []).some((m) => m.toLowerCase().includes(q)) ||
      (e.index_metadata?.search_terms ?? []).some((t) => t.includes(q))
  );
}

export async function registerLocalReferenceVersion(input: {
  entry_key: string;
  relativePath: string;
  fileName: string;
  mimeType: string;
  changeNotes?: string;
}): Promise<boolean> {
  const entry = await getKnowledgeEntryByKey(input.entry_key);
  if (!entry) return false;
  if (entry.active_version?.storage_path) return false;

  const versionId = newKnowledgeVersionId();
  try {
    const fileBuffer = await fs.readFile(resolveKnowledgeRelativePath(input.relativePath));
    const imported = await importLocalKnowledgeFile({
      relativePath: input.relativePath,
      entryId: entry.id,
      versionId,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });

    const index_metadata = indexKnowledgeDocument({
      buffer: fileBuffer,
      fileName: input.fileName,
      category: entry.category,
    });

    const versionRow = {
      id: versionId,
      entry_id: entry.id,
      version_number: 1,
      file_name: input.fileName,
      storage_path: imported.storagePath,
      file_size: imported.fileSize,
      mime_type: input.mimeType,
      is_active: true,
      change_notes: input.changeNotes ?? "Imported from local reference library",
      uploaded_by: null,
      uploaded_at: ts(),
      index_metadata,
      file_data_base64: imported.fileDataBase64,
    };

    if (!isSupabaseConfigured()) {
      memoryVersions.push(mapVersionRow(versionRow));
    } else {
      const supabase = await createClient();
      await supabase.from("qa_knowledge_versions").insert({
        id: versionId,
        entry_id: entry.id,
        version_number: 1,
        file_name: input.fileName,
        storage_path: imported.storagePath,
        file_size: imported.fileSize,
        mime_type: input.mimeType,
        is_active: true,
        change_notes: input.changeNotes ?? "Imported from local reference library",
        index_metadata,
      });
    }

    await updateKnowledgeEntryRecord(entry.id, {
      active_version_id: versionId,
      index_metadata: mergeEntryIndexMetadata(entry.index_metadata, index_metadata),
      tags: [
        ...new Set([
          ...entry.tags,
          ...(index_metadata.manufacturers?.map((m) => m.toLowerCase()) ?? []),
        ]),
      ],
    });
    await persistIndexTerms({ entryId: entry.id, versionId, metadata: index_metadata });
    return true;
  } catch {
    return false;
  }
}
