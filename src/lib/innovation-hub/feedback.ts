import { randomUUID } from "node:crypto";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackSubmission,
  FeedbackSubmissionView,
} from "@/types/flow";

const BUCKET = "feedback-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

let memorySubmissions: FeedbackSubmission[] = [];

function ts() {
  return new Date().toISOString();
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

function attachmentApiPath(id: string) {
  return `/api/feedback/${id}/attachment`;
}

function mapRow(row: Record<string, unknown>): FeedbackSubmission {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    user_name: String(row.user_name),
    user_email: row.user_email ? String(row.user_email) : null,
    category: String(row.category) as FeedbackCategory,
    title: String(row.title),
    description: String(row.description),
    priority: String(row.priority) as FeedbackPriority,
    screenshot_url: row.screenshot_url ? String(row.screenshot_url) : null,
    screenshot_storage_path: row.screenshot_storage_path
      ? String(row.screenshot_storage_path)
      : null,
    screenshot_mime_type: row.screenshot_mime_type ? String(row.screenshot_mime_type) : null,
    screenshot_file_name: row.screenshot_file_name ? String(row.screenshot_file_name) : null,
    page_url: row.page_url ? String(row.page_url) : null,
    app_version: row.app_version ? String(row.app_version) : null,
    device_info: row.device_info ? String(row.device_info) : null,
    status: String(row.status) as FeedbackStatus,
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    resolution_notes: row.resolution_notes ? String(row.resolution_notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function enrichViews(items: FeedbackSubmission[]): FeedbackSubmissionView[] {
  initFlowStore();
  const users = getFlowStore().users;
  return items.map((item) => ({
    ...item,
    assigned_to_name: item.assigned_to
      ? users.find((u) => u.id === item.assigned_to)?.full_name ?? item.assigned_to
      : null,
  }));
}

export async function listFeedbackSubmissions(): Promise<FeedbackSubmissionView[]> {
  if (!isSupabaseConfigured()) {
    return enrichViews(
      [...memorySubmissions].sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return enrichViews((data ?? []).map((row) => mapRow(row)));
}

export async function getFeedbackSubmissionById(
  id: string
): Promise<FeedbackSubmission | null> {
  if (!isSupabaseConfigured()) {
    return memorySubmissions.find((s) => s.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function createFeedbackSubmission(input: {
  user_id: string;
  user_name: string;
  user_email?: string | null;
  category: FeedbackCategory;
  title: string;
  description: string;
  priority: FeedbackPriority;
  page_url?: string | null;
  app_version?: string | null;
  device_info?: string | null;
  attachment?: {
    file_name: string;
    mime_type: string;
    buffer: Buffer;
  };
}): Promise<FeedbackSubmission> {
  const id = randomUUID();
  const now = ts();

  let screenshot_storage_path: string | null = null;
  let screenshot_mime_type: string | null = null;
  let screenshot_file_name: string | null = null;
  let screenshot_data_base64: string | undefined;

  if (input.attachment) {
    if (input.attachment.buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachment must be 10 MB or smaller");
    }
    const safeName = sanitizeFileName(input.attachment.file_name);
    screenshot_storage_path = `${input.user_id}/${id}-${safeName}`;
    screenshot_mime_type = input.attachment.mime_type;
    screenshot_file_name = input.attachment.file_name;
  }

  if (!isSupabaseConfigured()) {
    if (input.attachment) {
      screenshot_data_base64 = input.attachment.buffer.toString("base64");
    }
    const submission: FeedbackSubmission = {
      id,
      user_id: input.user_id,
      user_name: input.user_name,
      user_email: input.user_email ?? null,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      screenshot_url: input.attachment ? attachmentApiPath(id) : null,
      screenshot_storage_path,
      screenshot_mime_type,
      screenshot_file_name,
      page_url: input.page_url ?? null,
      app_version: input.app_version ?? null,
      device_info: input.device_info ?? null,
      status: "new",
      assigned_to: null,
      resolution_notes: null,
      created_at: now,
      updated_at: now,
      screenshot_data_base64,
    };
    memorySubmissions = [submission, ...memorySubmissions];
    return submission;
  }

  const supabase = await createClient();

  if (input.attachment && screenshot_storage_path) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(screenshot_storage_path, input.attachment.buffer, {
        contentType: input.attachment.mime_type,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("feedback_submissions")
    .insert({
      id,
      user_id: input.user_id,
      user_name: input.user_name,
      user_email: input.user_email ?? null,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      screenshot_url: input.attachment ? attachmentApiPath(id) : null,
      screenshot_storage_path,
      screenshot_mime_type,
      screenshot_file_name,
      page_url: input.page_url ?? null,
      app_version: input.app_version ?? null,
      device_info: input.device_info ?? null,
      status: "new",
    })
    .select("*")
    .single();

  if (error) {
    if (screenshot_storage_path) {
      await supabase.storage.from(BUCKET).remove([screenshot_storage_path]);
    }
    throw new Error(error.message);
  }

  return mapRow(data);
}

export async function updateFeedbackSubmission(
  id: string,
  patch: {
    status?: FeedbackStatus;
    assigned_to?: string | null;
    resolution_notes?: string | null;
  }
): Promise<FeedbackSubmission> {
  const existing = await getFeedbackSubmissionById(id);
  if (!existing) throw new Error("Feedback submission not found");

  const updated_at = ts();
  const next = {
    ...existing,
    status: patch.status ?? existing.status,
    assigned_to: patch.assigned_to !== undefined ? patch.assigned_to : existing.assigned_to,
    resolution_notes:
      patch.resolution_notes !== undefined ? patch.resolution_notes : existing.resolution_notes,
    updated_at,
  };

  if (!isSupabaseConfigured()) {
    memorySubmissions = memorySubmissions.map((s) => (s.id === id ? next : s));
    return next;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_submissions")
    .update({
      status: next.status,
      assigned_to: next.assigned_to,
      resolution_notes: next.resolution_notes,
      updated_at,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function downloadFeedbackAttachmentBuffer(
  submission: FeedbackSubmission
): Promise<Buffer> {
  if (submission.screenshot_data_base64) {
    return Buffer.from(submission.screenshot_data_base64, "base64");
  }

  if (!submission.screenshot_storage_path) {
    throw new Error("No attachment on this submission");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(submission.screenshot_storage_path);

  if (error || !data) throw new Error(error?.message ?? "Download failed");
  return Buffer.from(await data.arrayBuffer());
}
