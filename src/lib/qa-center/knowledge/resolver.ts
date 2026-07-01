import type { QaKnowledgeCategory } from "@/lib/qa-center/types";
import { listKnowledgeEntries } from "@/lib/qa-center/knowledge/db";
import { downloadKnowledgeVersionBuffer } from "@/lib/qa-center/knowledge/storage";

export interface KnowledgeReferenceContext {
  /** Active documents grouped by category — authoritative source for validation. */
  byCategory: Partial<Record<QaKnowledgeCategory, KnowledgeReferenceDoc[]>>;
  manufacturers: string[];
  hasActiveLibrary: boolean;
}

export interface KnowledgeReferenceDoc {
  entryId: string;
  entryKey: string | null;
  title: string;
  versionId: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  indexMetadata: Record<string, unknown> | null;
}

/** Load active knowledge library references for the QA validation engine. */
export async function loadKnowledgeReferenceContext(): Promise<KnowledgeReferenceContext> {
  const entries = await listKnowledgeEntries();
  const byCategory: KnowledgeReferenceContext["byCategory"] = {};
  const manufacturers = new Set<string>();

  for (const entry of entries) {
    const version = entry.active_version;
    if (!version?.storage_path || !version.file_name) continue;

    const doc: KnowledgeReferenceDoc = {
      entryId: entry.id,
      entryKey: entry.entry_key,
      title: entry.title,
      versionId: version.id,
      fileName: version.file_name,
      storagePath: version.storage_path,
      mimeType: version.mime_type,
      indexMetadata: (version.index_metadata as Record<string, unknown> | null) ?? null,
    };

    const list = byCategory[entry.category] ?? [];
    list.push(doc);
    byCategory[entry.category] = list;

    for (const m of entry.index_metadata?.manufacturers ?? version.index_metadata?.manufacturers ?? []) {
      manufacturers.add(m);
    }
  }

  return {
    byCategory,
    manufacturers: [...manufacturers].sort((a, b) => a.localeCompare(b)),
    hasActiveLibrary: Object.keys(byCategory).length > 0,
  };
}

export async function getKnowledgeDocumentBuffer(
  doc: KnowledgeReferenceDoc
): Promise<Buffer> {
  const version = {
    id: doc.versionId,
    entry_id: doc.entryId,
    version_number: 1,
    file_name: doc.fileName,
    storage_path: doc.storagePath,
    file_size: null,
    mime_type: doc.mimeType,
    is_active: true,
    change_notes: null,
    uploaded_by: null,
    uploaded_at: new Date().toISOString(),
  };
  return downloadKnowledgeVersionBuffer(version);
}

export async function getActiveReferencesForCategory(
  category: QaKnowledgeCategory
): Promise<KnowledgeReferenceDoc[]> {
  const ctx = await loadKnowledgeReferenceContext();
  return ctx.byCategory[category] ?? [];
}

export async function listIndexedManufacturers(): Promise<string[]> {
  const ctx = await loadKnowledgeReferenceContext();
  return ctx.manufacturers;
}
