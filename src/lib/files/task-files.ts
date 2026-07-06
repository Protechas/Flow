import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type { TaskFileUpload } from "@/types/flow";

const BUCKET = "task-files";

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export function taskFileStoragePath(taskId: string, fileId: string, fileName: string): string {
  return `${taskId}/${fileId}-${sanitizeFileName(fileName)}`;
}

export async function uploadTaskFileToStorage(input: {
  storagePath: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(input.storagePath, input.buffer, {
      contentType: input.contentType || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
}

export async function removeTaskFileFromStorage(storagePath: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

/** File bytes for an upload — demo base64 first, then Supabase Storage. */
export async function downloadTaskFileBuffer(file: TaskFileUpload): Promise<Buffer | null> {
  if (file.file_data_base64) {
    return Buffer.from(file.file_data_base64, "base64");
  }
  if (!file.storage_path || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(file.storage_path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
