import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type { QaKnowledgeVersion } from "@/lib/qa-center/types";
import { resolveKnowledgeRelativePath } from "@/lib/qa-center/knowledge/paths";

export const QA_KNOWLEDGE_BUCKET = "qa-knowledge";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export function buildKnowledgeStoragePath(input: {
  entryId: string;
  versionId: string;
  fileName: string;
}): string {
  return `${input.entryId}/${input.versionId}/${sanitizeFileName(input.fileName)}`;
}

export async function uploadKnowledgeFile(input: {
  entryId: string;
  versionId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ storagePath: string; fileDataBase64: string | null }> {
  const storagePath = buildKnowledgeStoragePath(input);

  if (!isSupabaseConfigured()) {
    const localPath = resolveKnowledgeRelativePath(`uploads/${storagePath}`);
    await fs.mkdir(localPath.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
    await fs.writeFile(localPath, input.buffer);
    return {
      storagePath: `uploads/${storagePath}`,
      fileDataBase64: input.buffer.toString("base64"),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(QA_KNOWLEDGE_BUCKET)
    .upload(storagePath, input.buffer, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return { storagePath, fileDataBase64: null };
}

export async function downloadKnowledgeVersionBuffer(
  version: QaKnowledgeVersion & { file_data_base64?: string | null }
): Promise<Buffer> {
  if (version.file_data_base64) {
    return Buffer.from(version.file_data_base64, "base64");
  }

  if (!version.storage_path) {
    throw new Error("No storage path for knowledge version");
  }

  if (!isSupabaseConfigured()) {
    const abs = resolveKnowledgeRelativePath(version.storage_path);
    return fs.readFile(abs);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(QA_KNOWLEDGE_BUCKET)
    .download(version.storage_path);
  if (error || !data) throw new Error(error?.message ?? "Download failed");
  return Buffer.from(await data.arrayBuffer());
}

export async function importLocalKnowledgeFile(input: {
  relativePath: string;
  entryId: string;
  versionId: string;
  fileName: string;
  mimeType: string;
}): Promise<{ storagePath: string; fileSize: number; fileDataBase64: string | null }> {
  const source = resolveKnowledgeRelativePath(input.relativePath);
  const buffer = await fs.readFile(source);
  const uploaded = await uploadKnowledgeFile({
    entryId: input.entryId,
    versionId: input.versionId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer,
  });
  return {
    storagePath: uploaded.storagePath,
    fileSize: buffer.length,
    fileDataBase64: uploaded.fileDataBase64,
  };
}

export function newKnowledgeVersionId(): string {
  return randomUUID();
}
