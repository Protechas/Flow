import { randomUUID } from "node:crypto";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCompanyDocumentMaxBytes, formatUploadLimitLabel } from "@/lib/files/upload-limits";
import type { RequestTicketFile, RequestTicketFileView } from "@/types/flow";

const BUCKET = "request-files";

/**
 * Files attached to request tickets — the deliverable travels with the
 * request. Supabase Storage-backed, in-memory fallback for demo mode.
 */

let memoryFiles: RequestTicketFile[] = [];

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

function mapRow(row: Record<string, unknown>): RequestTicketFile {
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    user_id: String(row.user_id),
    file_name: String(row.file_name),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    file_size: Number(row.file_size ?? 0),
    storage_path: String(row.storage_path),
    uploaded_at: String(row.uploaded_at),
  };
}

function enrich(files: RequestTicketFile[]): RequestTicketFileView[] {
  initFlowStore();
  const users = getFlowStore().users;
  return files.map((f) => ({
    ...f,
    uploaded_by_name: users.find((u) => u.id === f.user_id)?.full_name ?? f.user_id,
  }));
}

/** Files for a batch of tickets, keyed by ticket id — one query per page. */
export async function listFilesForTickets(
  ticketIds: string[]
): Promise<Record<string, RequestTicketFileView[]>> {
  if (ticketIds.length === 0) return {};

  let files: RequestTicketFile[];
  if (!isSupabaseConfigured()) {
    const wanted = new Set(ticketIds);
    files = memoryFiles.filter((f) => wanted.has(f.ticket_id));
  } else {
    const supabase = await dbClient();
    const { data, error } = await supabase
      .from("request_ticket_files")
      .select("*")
      .in("ticket_id", ticketIds)
      .order("uploaded_at", { ascending: true });
    if (error) throw new Error(error.message);
    files = (data ?? []).map(mapRow);
  }

  const byTicket: Record<string, RequestTicketFileView[]> = {};
  for (const file of enrich(files)) {
    (byTicket[file.ticket_id] ??= []).push(file);
  }
  return byTicket;
}

export async function getTicketFileById(id: string): Promise<RequestTicketFile | null> {
  if (!isSupabaseConfigured()) {
    return memoryFiles.find((f) => f.id === id) ?? null;
  }
  const supabase = await dbClient();
  const { data, error } = await supabase
    .from("request_ticket_files")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function uploadTicketFile(input: {
  ticket_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  buffer: Buffer;
}): Promise<RequestTicketFile> {
  if (input.buffer.length > getCompanyDocumentMaxBytes()) {
    throw new Error(
      `File must be ${formatUploadLimitLabel(getCompanyDocumentMaxBytes())} or smaller`
    );
  }

  const id = randomUUID();
  const storagePath = `${input.ticket_id}/${id}-${sanitizeFileName(input.file_name)}`;
  const file: RequestTicketFile = {
    id,
    ticket_id: input.ticket_id,
    user_id: input.user_id,
    file_name: input.file_name,
    mime_type: input.mime_type || "application/octet-stream",
    file_size: input.buffer.length,
    storage_path: storagePath,
    uploaded_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    memoryFiles = [...memoryFiles, { ...file, file_data_base64: input.buffer.toString("base64") }];
    return file;
  }

  const supabase = await dbClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.buffer, { contentType: file.mime_type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("request_ticket_files")
    .insert({
      id: file.id,
      ticket_id: file.ticket_id,
      user_id: file.user_id,
      file_name: file.file_name,
      mime_type: file.mime_type,
      file_size: file.file_size,
      storage_path: file.storage_path,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  return mapRow(data);
}

export async function deleteTicketFile(id: string): Promise<void> {
  const file = await getTicketFileById(id);
  if (!file) return;

  if (!isSupabaseConfigured()) {
    memoryFiles = memoryFiles.filter((f) => f.id !== id);
    return;
  }
  const supabase = await dbClient();
  await supabase.storage.from(BUCKET).remove([file.storage_path]);
  const { error } = await supabase.from("request_ticket_files").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function downloadTicketFileBuffer(file: RequestTicketFile): Promise<Buffer> {
  if (file.file_data_base64) {
    return Buffer.from(file.file_data_base64, "base64");
  }
  if (!isSupabaseConfigured()) {
    const memory = memoryFiles.find((f) => f.id === file.id);
    if (memory?.file_data_base64) return Buffer.from(memory.file_data_base64, "base64");
    throw new Error("File content unavailable");
  }
  const supabase = await dbClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(file.storage_path);
  if (error || !data) throw new Error(error?.message ?? "Download failed");
  return Buffer.from(await data.arrayBuffer());
}
