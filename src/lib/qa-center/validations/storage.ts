import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { resolveKnowledgeRelativePath } from "@/lib/qa-center/knowledge/paths";
import { QA_KNOWLEDGE_BUCKET } from "@/lib/qa-center/knowledge/storage";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export function newUploadBatchId(): string {
  return randomUUID();
}

export async function storeIntakeFile(input: {
  batchId: string;
  validationId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const storagePath = `intake/${input.batchId}/${input.validationId}/${sanitizeFileName(input.fileName)}`;

  if (!isSupabaseConfigured()) {
    const localPath = resolveKnowledgeRelativePath(`uploads/${storagePath}`);
    await fs.mkdir(localPath.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
    await fs.writeFile(localPath, input.buffer);
    return `uploads/${storagePath}`;
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(QA_KNOWLEDGE_BUCKET)
    .upload(storagePath, input.buffer, { contentType: input.mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return storagePath;
}

export async function readIntakeFile(storagePath: string): Promise<Buffer> {
  if (!isSupabaseConfigured()) {
    return fs.readFile(resolveKnowledgeRelativePath(storagePath));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(QA_KNOWLEDGE_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Download failed");
  return Buffer.from(await data.arrayBuffer());
}

/** Guess manufacturer from filename like "Toyota_2024_Camera.pdf" */
export function guessManufacturerFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/, "");
  const tokens = base.split(/[\s_\-]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  if (/^\d{4}$/.test(first) && tokens[1]) return tokens[1];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
