import "server-only";

import { extractDocFromBuffer } from "@/lib/content-checks/extract-server";
import { runContentChecksOnSet, type CheckFlag } from "@/lib/content-checks/engine";
import { DEFAULT_CONTENT_RULES } from "@/lib/content-checks/rules";
import { downloadTaskFileBuffer } from "@/lib/files/task-files";
import { getTaskFiles } from "@/lib/data/production-tracking";
import { eddyReviewContent, type EddyContentReview } from "@/lib/ai/content-review";
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

/** Stored result of a manual per-submission Eddy read (jsonb `eddy` column). */
export interface EddyFileReview extends EddyContentReview {
  reviewed_at: string;
  reviewed_by: string;
}

export interface ContentReviewRow {
  file_id: string;
  task_id: string;
  file_name: string;
  verdict: "pass" | "flagged" | "unreadable";
  flags: CheckFlag[];
  is_placeholder: boolean;
  eddy: EddyFileReview | null;
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

    // Per-team opt-out: SI Library rules only apply to teams whose operating
    // model keeps content checks on (default on). Non-SI teams' PDFs would
    // otherwise be false-flagged against naming/orientation/highlight rules.
    const { getFlowStore, listTeamsStore } = await import("@/lib/data/flow-store");
    const { contentChecksEnabledForProject } = await import("@/lib/operating-models/resolve");
    const task = getFlowStore().workPackages.find((p) => p.id === taskId);
    const project = task
      ? getFlowStore().projects.find((p) => p.id === task.project_id)
      : null;
    if (project && !contentChecksEnabledForProject(project, listTeamsStore())) {
      return;
    }

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

/**
 * Manual per-submission Eddy read (the paid layer — explicit button only,
 * never automatic). Downloads the task's PDFs, extracts server-side, sends
 * each readable file to Eddy with its auto-check flags as structural notes,
 * and stores the result in the row's `eddy` jsonb. Placeholder files and
 * unreadable files are skipped (nothing to judge / no text to read).
 */
export async function runEddyReviewForTask(
  taskId: string,
  input: { userId: string; taskTitle?: string | null; projectName?: string | null }
): Promise<{ reviewed: number; skipped: number; issues: number }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const existing = await listContentReviewsForTask(taskId);
  const byFileId = new Map(existing.map((r) => [r.file_id, r]));

  const files = getTaskFiles(taskId).filter((f) =>
    f.file_name.toLowerCase().endsWith(".pdf")
  );
  if (files.length === 0) return { reviewed: 0, skipped: 0, issues: 0 };

  const claimContext = [input.taskTitle, input.projectName]
    .filter(Boolean)
    .join(" · ");

  let reviewed = 0;
  let skipped = 0;
  let issues = 0;
  const client = await dbClient();

  for (const file of files) {
    const row = byFileId.get(file.id);
    if (row?.is_placeholder || row?.verdict === "unreadable") {
      skipped += 1;
      continue;
    }
    const buffer = await downloadTaskFileBuffer(file);
    if (!buffer) {
      skipped += 1;
      continue;
    }
    const doc = await extractDocFromBuffer(file.file_name, buffer);
    if (!doc.hasTextLayer || !doc.text.trim()) {
      skipped += 1;
      continue;
    }
    const structuralNote = row?.flags?.length
      ? row.flags.map((f) => `${f.severity}: ${f.message ?? f.code}`).join("; ")
      : undefined;

    const review = await eddyReviewContent({
      fileName: file.file_name,
      claim: claimContext
        ? `${file.file_name} (task: ${claimContext})`
        : file.file_name,
      text: doc.text,
      structuralNote,
      userId: input.userId,
    });
    if (review.verdict === "issues_found") issues += 1;

    const eddy: EddyFileReview = {
      ...review,
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.userId,
    };
    const { error } = await client
      .from("document_content_reviews")
      .upsert(
        {
          file_id: file.id,
          task_id: taskId,
          project_id: file.project_id ?? null,
          uploader_id: file.user_id ?? null,
          file_name: file.file_name,
          verdict: row?.verdict ?? "pass",
          flags: row?.flags ?? [],
          is_placeholder: row?.is_placeholder ?? false,
          source: row ? undefined : "manual",
          checked_at: row?.checked_at ?? new Date().toISOString(),
          eddy,
        },
        { onConflict: "file_id" }
      );
    if (error) {
      console.error("[content-reviews] eddy upsert failed:", error.message);
    } else {
      reviewed += 1;
    }
  }

  return { reviewed, skipped, issues };
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
