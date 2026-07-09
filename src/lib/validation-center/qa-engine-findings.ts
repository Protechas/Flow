import { randomUUID } from "node:crypto";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type QaEngineFindingStatus = "open" | "reviewed" | "dismissed" | "ready_for_task";

export interface QaEngineFinding {
  id: string;
  run_id: string;
  issue_type: string;
  severity: "high" | "medium" | "low";
  title: string;
  source_file: string;
  sheet_name: string | null;
  row_number: number | null;
  column_name: string | null;
  expected: string | null;
  found: string | null;
  explanation: string | null;
  suggested_task_title: string | null;
  suggested_task_description: string | null;
  suggested_priority: string | null;
  suggested_assignee: string | null;
  status: QaEngineFindingStatus;
  created_at: string;
}

let memoryFindings: QaEngineFinding[] = [];

function admin() {
  return isSupabaseConfigured() && isAdminConfigured() ? createAdminClient() : null;
}

function str(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

export async function importQaEngineFindings(
  runId: string,
  raw: Record<string, unknown>[]
): Promise<void> {
  const rows = raw.map((f) => ({
    id: randomUUID(),
    run_id: runId,
    issue_type: String(f.issue_type ?? "other"),
    severity: (["high", "medium", "low"].includes(String(f.severity))
      ? String(f.severity)
      : "low") as QaEngineFinding["severity"],
    title: String(f.title ?? "Finding"),
    source_file: String(f.source_file ?? "unknown"),
    sheet_name: str(f.sheet_name),
    row_number: f.row_number != null ? Number(f.row_number) : null,
    column_name: str(f.column_name),
    expected: str(f.expected),
    found: str(f.found),
    explanation: str(f.explanation),
    suggested_task_title: str(f.suggested_task_title),
    suggested_task_description: str(f.suggested_task_description),
    suggested_priority: str(f.suggested_priority),
    suggested_assignee: str(f.suggested_assignee),
    status: "open" as const,
    created_at: new Date().toISOString(),
  }));
  const db = admin();
  if (!db) {
    memoryFindings = [...rows, ...memoryFindings];
    return;
  }
  // Replace any previous import for this run (retries shouldn't duplicate).
  await db.from("qa_engine_findings").delete().eq("run_id", runId);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("qa_engine_findings").insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
}

export async function listQaEngineFindings(): Promise<QaEngineFinding[]> {
  const db = admin();
  if (!db) return [...memoryFindings];
  let all: QaEngineFinding[] = [];
  let from = 0;
  // Page past PostgREST's 1000-row cap.
  for (;;) {
    const { data, error } = await db
      .from("qa_engine_findings")
      .select("*")
      .order("created_at", { ascending: false })
      .order("severity", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all = all.concat((data ?? []) as QaEngineFinding[]);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

export async function setQaEngineFindingStatus(
  id: string,
  status: QaEngineFindingStatus
): Promise<void> {
  const db = admin();
  if (!db) {
    const idx = memoryFindings.findIndex((f) => f.id === id);
    if (idx >= 0) memoryFindings[idx] = { ...memoryFindings[idx], status };
    return;
  }
  const { error } = await db
    .from("qa_engine_findings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
