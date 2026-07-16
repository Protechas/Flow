import "server-only";

import { extractDocFromBuffer } from "@/lib/content-checks/extract-server";
import { runContentChecksOnSet, type CheckFlag } from "@/lib/content-checks/engine";
import { DEFAULT_CONTENT_RULES } from "@/lib/content-checks/rules";
import { downloadTaskFileBuffer } from "@/lib/files/task-files";
import { getTaskFiles } from "@/lib/data/production-tracking";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * QA-side content checks: free layers only (structural, identity, sections,
 * highlights — never AI), run after task submission via next/server after()
 * so submitting stays instant. One row per file in document_content_reviews;
 * Tara's Review Queue reads the rollup for badges and flagged-first order.
 * Best-effort by design: a check failure must never break a submission.
 */

export interface ContentReviewRow {
  file_id: string;
  task_id: string;
  file_name: string;
  verdict: "pass" | "flagged" | "unreadable";
  flags: CheckFlag[];
  is_placeholder: boolean;
  eddy: unknown | null;
  checked_at: string;
}

export interface TaskContentReviewSummary {
  checked: number;
  flagged: number;
  unreadable: number;
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

export async function runAutoContentChecksForTask(
  taskId: string,
  fileIds?: string[] | null
): Promise<void> {
  try {
    if (!isSupabaseConfigured()) return;

    const wanted = fileIds?.length ? new Set(fileIds) : null;
    const files = getTaskFiles(taskId).filter(
      (f) =>
        f.file_name.toLowerCase().endsWith(".pdf") &&
        (!wanted || wanted.has(f.id))
    );
    if (files.length === 0) return;

    const extracted = [];
    const uploadByName = new Map<string, (typeof files)[number]>();
    for (const file of files) {
      const buffer = await downloadTaskFileBuffer(file);
      if (!buffer) continue;
      uploadByName.set(file.file_name, file);
      extracted.push(await extractDocFromBuffer(file.file_name, buffer));
    }
    if (extracted.length === 0) return;

    const results = runContentChecksOnSet(extracted, DEFAULT_CONTENT_RULES);
    const now = new Date().toISOString();
    const rows = [];
    for (const logical of results) {
      for (const partName of logical.partFiles) {
        const upload = uploadByName.get(partName);
        if (!upload) continue;
        rows.push({
          file_id: upload.id,
          task_id: taskId,
          project_id: upload.project_id ?? null,
          uploader_id: upload.user_id ?? null,
          file_name: upload.file_name,
          verdict: logical.result.verdict,
          flags: logical.result.flags,
          is_placeholder: logical.result.isPlaceholder,
          source: "auto",
          checked_at: now,
        });
      }
    }
    if (rows.length === 0) return;

    const client = await dbClient();
    const { error } = await client
      .from("document_content_reviews")
      .upsert(rows, { onConflict: "file_id" });
    if (error) {
      console.error("[content-reviews] upsert failed:", error.message);
    }
  } catch (e) {
    console.error(
      "[content-reviews] auto check failed:",
      e instanceof Error ? e.message : e
    );
  }
}

/** Per-task rollups for a set of tasks (badges + queue ordering). */
export async function getContentReviewSummaries(
  taskIds: string[]
): Promise<Record<string, TaskContentReviewSummary>> {
  const out: Record<string, TaskContentReviewSummary> = {};
  try {
    if (!isSupabaseConfigured() || taskIds.length === 0) return out;
    const client = await dbClient();
    const { data, error } = await client
      .from("document_content_reviews")
      .select("task_id, verdict")
      .in("task_id", taskIds);
    if (error || !data) return out;
    for (const row of data) {
      const entry = (out[row.task_id] ??= { checked: 0, flagged: 0, unreadable: 0 });
      entry.checked += 1;
      if (row.verdict === "flagged") entry.flagged += 1;
      if (row.verdict === "unreadable") entry.unreadable += 1;
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * file_id → verdict for every checked upload. The whole table is small
 * (one row per submitted file), so one read serves the Files browser.
 */
export async function getContentReviewVerdictMap(): Promise<
  Record<string, "pass" | "flagged" | "unreadable">
> {
  const out: Record<string, "pass" | "flagged" | "unreadable"> = {};
  try {
    if (!isSupabaseConfigured()) return out;
    const client = await dbClient();
    const { data, error } = await client
      .from("document_content_reviews")
      .select("file_id, verdict");
    if (error || !data) return out;
    for (const row of data) {
      out[row.file_id] = row.verdict as "pass" | "flagged" | "unreadable";
    }
    return out;
  } catch {
    return out;
  }
}

/** File-level detail for one task (per-file badges in the review panels). */
export async function listContentReviewsForTask(
  taskId: string
): Promise<ContentReviewRow[]> {
  try {
    if (!isSupabaseConfigured()) return [];
    const client = await dbClient();
    const { data, error } = await client
      .from("document_content_reviews")
      .select("file_id, task_id, file_name, verdict, flags, is_placeholder, eddy, checked_at")
      .eq("task_id", taskId);
    if (error || !data) return [];
    return data as ContentReviewRow[];
  } catch {
    return [];
  }
}
