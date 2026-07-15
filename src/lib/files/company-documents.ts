import { randomUUID } from "node:crypto";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentView,
} from "@/types/flow";

import { getCompanyDocumentMaxBytes, formatUploadLimitLabel } from "@/lib/files/upload-limits";

const BUCKET = "company-documents";

/** List queries never fetch content_html — it can be large; the editor fetches it per-doc. */
const LIST_COLUMNS =
  "id, title, description, category, folder_id, tags, file_name, storage_path, file_size, mime_type, uploaded_by, created_at, content_updated_at, content_updated_by, current_revision_id, is_protected";

let memoryDocuments: CompanyDocument[] = [];

function ts() {
  return new Date().toISOString();
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, 40);
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, 12);
}

function mapRow(row: Record<string, unknown>): CompanyDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    category: String(row.category) as CompanyDocumentCategory,
    folder_id: row.folder_id != null ? String(row.folder_id) : null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    file_name: String(row.file_name),
    storage_path: String(row.storage_path),
    file_size: Number(row.file_size ?? 0),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    uploaded_by: String(row.uploaded_by),
    created_at: String(row.created_at),
    content_updated_at: row.content_updated_at != null ? String(row.content_updated_at) : null,
    content_updated_by: row.content_updated_by != null ? String(row.content_updated_by) : null,
    current_revision_id:
      row.current_revision_id != null ? String(row.current_revision_id) : null,
    is_protected: Boolean(row.is_protected),
  };
}

function enrichViews(docs: CompanyDocument[]): CompanyDocumentView[] {
  initFlowStore();
  const users = getFlowStore().users;
  return docs.map((doc) => ({
    ...doc,
    uploaded_by_name:
      users.find((u) => u.id === doc.uploaded_by)?.full_name ?? doc.uploaded_by,
  }));
}

export async function listCompanyDocuments(): Promise<CompanyDocumentView[]> {
  if (!isSupabaseConfigured()) {
    return enrichViews(
      [...memoryDocuments].sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_documents")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return enrichViews((data ?? []).map((row) => mapRow(row)));
}

export async function getCompanyDocumentById(
  id: string
): Promise<CompanyDocument | null> {
  if (!isSupabaseConfigured()) {
    return memoryDocuments.find((d) => d.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_documents")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function uploadCompanyDocument(input: {
  title: string;
  description?: string;
  category: CompanyDocumentCategory;
  folder_id?: string | null;
  tags?: string[];
  file_name: string;
  mime_type: string;
  file_size: number;
  buffer: Buffer;
  uploaded_by: string;
}): Promise<CompanyDocument> {
  if (input.file_size > getCompanyDocumentMaxBytes()) {
    throw new Error(
      `File must be ${formatUploadLimitLabel(getCompanyDocumentMaxBytes())} or smaller`
    );
  }

  const id = randomUUID();
  const safeName = sanitizeFileName(input.file_name);
  const storagePath = `${input.uploaded_by}/${id}-${safeName}`;
  const tags = normalizeTags(input.tags ?? []);
  const folderId = input.folder_id ?? null;

  if (!isSupabaseConfigured()) {
    const doc: CompanyDocument = {
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      folder_id: folderId,
      tags,
      file_name: input.file_name,
      storage_path: storagePath,
      file_size: input.file_size,
      mime_type: input.mime_type,
      uploaded_by: input.uploaded_by,
      created_at: ts(),
      content_updated_at: null,
      content_updated_by: null,
      file_data_base64: input.buffer.toString("base64"),
    };
    memoryDocuments = [doc, ...memoryDocuments];
    return doc;
  }

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.buffer, {
      contentType: input.mime_type,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("company_documents")
    .insert({
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      folder_id: folderId,
      tags,
      file_name: input.file_name,
      storage_path: storagePath,
      file_size: input.file_size,
      mime_type: input.mime_type,
      uploaded_by: input.uploaded_by,
    })
    .select(LIST_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  return mapRow(data);
}

/**
 * A document authored inside Flow — no uploaded original. The stored "file" is
 * an HTML snapshot taken at creation, so download-original always works; the
 * live content lives in content_html like any Flow-edited doc.
 */
export async function createFlowNativeDocument(input: {
  title: string;
  description?: string;
  category: CompanyDocumentCategory;
  folder_id?: string | null;
  tags?: string[];
  created_by: string;
}): Promise<CompanyDocument> {
  const title = input.title.trim();
  const escaped = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const initialHtml = `<h1>${escaped}</h1><p></p>`;
  const buffer = Buffer.from(initialHtml, "utf8");

  const doc = await uploadCompanyDocument({
    title,
    description: input.description,
    category: input.category,
    folder_id: input.folder_id,
    tags: input.tags,
    file_name: `${sanitizeFileName(title) || "document"}.html`,
    mime_type: "text/html",
    file_size: buffer.length,
    buffer,
    uploaded_by: input.created_by,
  });
  await saveCompanyDocumentContent(doc.id, initialHtml, input.created_by);
  return doc;
}

export async function updateCompanyDocumentMeta(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    category?: CompanyDocumentCategory;
    folder_id?: string | null;
    tags?: string[];
  }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.folder_id !== undefined) update.folder_id = patch.folder_id;
  if (patch.tags !== undefined) update.tags = normalizeTags(patch.tags);
  if (Object.keys(update).length === 0) return;

  if (!isSupabaseConfigured()) {
    memoryDocuments = memoryDocuments.map((d) =>
      d.id === id ? ({ ...d, ...update } as CompanyDocument) : d
    );
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("company_documents").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

/** The in-Flow edited copy; null when the doc has never been edited in Flow. */
export async function getCompanyDocumentContent(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return memoryDocuments.find((d) => d.id === id)?.content_html_memory ?? null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_documents")
    .select("content_html")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.content_html != null ? String(data.content_html) : null;
}

export async function saveCompanyDocumentContent(
  id: string,
  html: string,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryDocuments = memoryDocuments.map((d) =>
      d.id === id
        ? {
            ...d,
            content_html_memory: html,
            content_updated_at: ts(),
            content_updated_by: userId,
          }
        : d
    );
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_documents")
    .update({
      content_html: html,
      content_updated_at: ts(),
      content_updated_by: userId,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCompanyDocument(id: string): Promise<void> {
  const doc = await getCompanyDocumentById(id);
  if (!doc) return;

  if (!isSupabaseConfigured()) {
    memoryDocuments = memoryDocuments.filter((d) => d.id !== id);
    return;
  }

  const supabase = await createClient();
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([doc.storage_path]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from("company_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function downloadCompanyDocumentBuffer(
  doc: CompanyDocument
): Promise<Buffer> {
  if (doc.file_data_base64) {
    return Buffer.from(doc.file_data_base64, "base64");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(doc.storage_path);

  if (error || !data) throw new Error(error?.message ?? "Download failed");
  return Buffer.from(await data.arrayBuffer());
}
