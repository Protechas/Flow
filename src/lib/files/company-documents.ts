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

let memoryDocuments: CompanyDocument[] = [];

function ts() {
  return new Date().toISOString();
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

function mapRow(row: Record<string, unknown>): CompanyDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    category: String(row.category) as CompanyDocumentCategory,
    file_name: String(row.file_name),
    storage_path: String(row.storage_path),
    file_size: Number(row.file_size ?? 0),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    uploaded_by: String(row.uploaded_by),
    created_at: String(row.created_at),
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
    .select("*")
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
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function uploadCompanyDocument(input: {
  title: string;
  description?: string;
  category: CompanyDocumentCategory;
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

  if (!isSupabaseConfigured()) {
    const doc: CompanyDocument = {
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      file_name: input.file_name,
      storage_path: storagePath,
      file_size: input.file_size,
      mime_type: input.mime_type,
      uploaded_by: input.uploaded_by,
      created_at: ts(),
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
      file_name: input.file_name,
      storage_path: storagePath,
      file_size: input.file_size,
      mime_type: input.mime_type,
      uploaded_by: input.uploaded_by,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  return mapRow(data);
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
