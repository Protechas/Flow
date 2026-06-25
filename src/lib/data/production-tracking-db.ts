import { cache } from "react";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  replaceProductionTrackingStore,
} from "@/lib/data/production-tracking";
import type {
  QaReviewRecord,
  TaskFileUpload,
  TaskSubmissionRecord,
  TaskTimeEntry,
  TimeClockEntry,
} from "@/types/flow";
import { subDays, format } from "date-fns";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return msg.includes("does not exist");
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length ? s : null;
}

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapClock(row: Record<string, unknown>): TimeClockEntry {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    department_id: row.department_id ? String(row.department_id) : null,
    clock_in_at: String(row.clock_in_at),
    clock_out_at: str(row.clock_out_at),
    total_minutes: row.total_minutes != null ? num(row.total_minutes) : null,
    clock_out_type: row.clock_out_type as TimeClockEntry["clock_out_type"],
    status: String(row.status ?? "active") as TimeClockEntry["status"],
    edited_by: row.edited_by ? String(row.edited_by) : null,
    edit_reason: str(row.edit_reason),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function enrichTaskTime(row: Record<string, unknown>): TaskTimeEntry {
  initFlowStore();
  const taskId = String(row.task_id);
  const pkg = getFlowStore().workPackages.find((p) => p.id === taskId);
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    task_id: taskId,
    project_id: String(row.project_id),
    manufacturer_id: pkg?.manufacturer_id ?? "",
    year_work_item_id: pkg?.year_work_item_id ?? "",
    started_at: String(row.started_at),
    paused_at: str(row.paused_at),
    resumed_at: str(row.resumed_at),
    completed_at: str(row.completed_at),
    total_active_minutes: num(row.total_active_minutes),
    pause_events: (row.pause_events as TaskTimeEntry["pause_events"]) ?? [],
    status: String(row.status ?? "active") as TaskTimeEntry["status"],
    is_correction_session: Boolean(row.is_correction_session),
    department_id: pkg?.department_id ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapFile(row: Record<string, unknown>): TaskFileUpload {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    project_id: String(row.project_id),
    department_id: row.department_id ? String(row.department_id) : null,
    user_id: String(row.user_id),
    file_name: String(row.file_name),
    file_type: String(row.file_type),
    file_size: num(row.file_size),
    file_url_or_path: String(row.file_url_or_path),
    uploaded_at: String(row.uploaded_at),
    created_at: String(row.created_at),
  };
}

function mapSubmission(row: Record<string, unknown>): TaskSubmissionRecord {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    project_id: String(row.project_id),
    user_id: String(row.user_id),
    submitted_at: String(row.submitted_at),
    uploaded_file_count: num(row.uploaded_file_count),
    total_task_minutes: num(row.total_task_minutes),
    average_minutes_per_document: num(row.average_minutes_per_document),
    documents_per_hour: num(row.documents_per_hour),
    original_task_minutes: num(row.original_task_minutes),
    correction_task_minutes: num(row.correction_task_minutes),
    status: String(row.status ?? "submitted") as TaskSubmissionRecord["status"],
    notes: str(row.notes),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapQaReview(row: Record<string, unknown>): QaReviewRecord {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    submission_id: row.submission_id ? String(row.submission_id) : null,
    reviewer_id: String(row.reviewer_id),
    reviewed_at: String(row.reviewed_at),
    status: row.status as QaReviewRecord["status"],
    notes: str(row.notes),
    correction_required: Boolean(row.correction_required),
    correction_reason: str(row.correction_reason),
    created_at: String(row.created_at),
  };
}

const hydrateProduction = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;

  const since = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const [clocks, tasks, files, subs, qa] = await Promise.all([
    supabase
      .from("time_clock_entries")
      .select("*")
      .gte("clock_in_at", `${since}T00:00:00Z`)
      .order("clock_in_at", { ascending: false }),
    supabase
      .from("task_time_entries")
      .select("*")
      .gte("started_at", `${since}T00:00:00Z`)
      .order("started_at", { ascending: false }),
    supabase.from("task_file_uploads").select("*").order("uploaded_at", { ascending: false }).limit(5000),
    supabase
      .from("task_submission_records")
      .select("*")
      .gte("submitted_at", `${since}T00:00:00Z`)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("qa_review_records")
      .select("*")
      .gte("reviewed_at", `${since}T00:00:00Z`)
      .order("reviewed_at", { ascending: false }),
  ]);

  if (clocks.error && !isUnavailable(clocks.error)) throw new Error(clocks.error.message);
  if (tasks.error && !isUnavailable(tasks.error)) throw new Error(tasks.error.message);
  if (files.error && !isUnavailable(files.error)) throw new Error(files.error.message);
  if (subs.error && !isUnavailable(subs.error)) throw new Error(subs.error.message);
  if (qa.error && !isUnavailable(qa.error)) throw new Error(qa.error.message);

  replaceProductionTrackingStore({
    timeClockEntries: (clocks.data ?? []).map((r) => mapClock(r as Record<string, unknown>)),
    taskTimeEntries: (tasks.data ?? []).map((r) => enrichTaskTime(r as Record<string, unknown>)),
    taskFileUploads: (files.data ?? []).map((r) => mapFile(r as Record<string, unknown>)),
    taskSubmissions: (subs.data ?? []).map((r) => mapSubmission(r as Record<string, unknown>)),
    qaReviewRecords: (qa.data ?? []).map((r) => mapQaReview(r as Record<string, unknown>)),
  });
});

export async function ensureProductionTrackingHydrated(): Promise<void> {
  await hydrateProduction();
}

function persistLater(fn: () => Promise<void>) {
  if (!isSupabaseConfigured()) return;
  void fn().catch((err) => console.error("[production-tracking-db]", err));
}

export function persistTimeClockEntry(entry: TimeClockEntry): void {
  persistLater(async () => {
    const supabase = await dbClient();
    if (!supabase) return;
    const row = {
      id: entry.id,
      user_id: entry.user_id,
      clock_in_at: entry.clock_in_at,
      clock_out_at: entry.clock_out_at,
      total_minutes: entry.total_minutes,
      clock_out_type: entry.clock_out_type,
      status: entry.status,
      edited_by: entry.edited_by,
      edit_reason: entry.edit_reason,
      updated_at: entry.updated_at,
    };
    const { error } = await supabase.from("time_clock_entries").upsert(row, { onConflict: "id" });
    if (error && !isUnavailable(error)) throw error;
  });
}

export function persistTaskTimeEntry(entry: TaskTimeEntry): void {
  persistLater(async () => {
    const supabase = await dbClient();
    if (!supabase) return;
    const row = {
      id: entry.id,
      user_id: entry.user_id,
      task_id: entry.task_id,
      project_id: entry.project_id,
      started_at: entry.started_at,
      paused_at: entry.paused_at,
      resumed_at: entry.resumed_at,
      completed_at: entry.completed_at,
      total_active_minutes: entry.total_active_minutes,
      pause_events: entry.pause_events,
      status: entry.status,
      is_correction_session: entry.is_correction_session,
      updated_at: entry.updated_at,
    };
    const { error } = await supabase.from("task_time_entries").upsert(row, { onConflict: "id" });
    if (error && !isUnavailable(error)) throw error;
  });
}

export function persistTaskFileUpload(file: TaskFileUpload): void {
  persistLater(async () => {
    const supabase = await dbClient();
    if (!supabase) return;
    const row = {
      id: file.id,
      task_id: file.task_id,
      project_id: file.project_id,
      department_id: file.department_id,
      user_id: file.user_id,
      file_name: file.file_name,
      file_type: file.file_type,
      file_size: file.file_size,
      file_url_or_path: file.file_url_or_path,
      uploaded_at: file.uploaded_at,
    };
    const { error } = await supabase.from("task_file_uploads").upsert(row, { onConflict: "id" });
    if (error && !isUnavailable(error)) throw error;
  });
}

export function persistTaskSubmission(record: TaskSubmissionRecord): void {
  persistLater(async () => {
    const supabase = await dbClient();
    if (!supabase) return;
    const row = {
      id: record.id,
      task_id: record.task_id,
      project_id: record.project_id,
      user_id: record.user_id,
      submitted_at: record.submitted_at,
      uploaded_file_count: record.uploaded_file_count,
      total_task_minutes: record.total_task_minutes,
      average_minutes_per_document: record.average_minutes_per_document,
      documents_per_hour: record.documents_per_hour,
      original_task_minutes: record.original_task_minutes,
      correction_task_minutes: record.correction_task_minutes,
      status: record.status,
      notes: record.notes,
      updated_at: record.updated_at,
    };
    const { error } = await supabase.from("task_submission_records").upsert(row, { onConflict: "id" });
    if (error && !isUnavailable(error)) throw error;
  });
}

export function persistQaReviewRecord(record: QaReviewRecord): void {
  persistLater(async () => {
    const supabase = await dbClient();
    if (!supabase) return;
    const row = {
      id: record.id,
      task_id: record.task_id,
      submission_id: record.submission_id,
      reviewer_id: record.reviewer_id,
      reviewed_at: record.reviewed_at,
      status: record.status,
      notes: record.notes,
      correction_required: record.correction_required,
      correction_reason: record.correction_reason,
    };
    const { error } = await supabase.from("qa_review_records").upsert(row, { onConflict: "id" });
    if (error && !isUnavailable(error)) throw error;
  });
}
