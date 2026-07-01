import { randomUUID } from "node:crypto";
import type { QaDocumentValidation, QaValidationIssue } from "@/lib/qa-center/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import {
  isQaCenterTableUnavailable,
  qaCenterTablesMissingMessage,
} from "@/lib/qa-center/supabase-errors";

let memoryValidations: QaDocumentValidation[] = [];

function ts() {
  return new Date().toISOString();
}

function mapRow(row: Record<string, unknown>): QaDocumentValidation {
  return {
    id: String(row.id),
    status: String(row.status) as QaDocumentValidation["status"],
    upload_batch_id: row.upload_batch_id ? String(row.upload_batch_id) : null,
    file_name: String(row.file_name),
    storage_path: row.storage_path ? String(row.storage_path) : null,
    file_size: row.file_size != null ? Number(row.file_size) : null,
    mime_type: row.mime_type ? String(row.mime_type) : null,
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    make: row.make ? String(row.make) : null,
    model: row.model ? String(row.model) : null,
    year: row.year != null ? Number(row.year) : null,
    component: row.component ? String(row.component) : null,
    analyst_id: row.analyst_id ? String(row.analyst_id) : null,
    assigned_analyst_id: row.assigned_analyst_id ? String(row.assigned_analyst_id) : null,
    project_id: row.project_id ? String(row.project_id) : null,
    work_package_id: row.work_package_id ? String(row.work_package_id) : null,
    qa_score: row.qa_score != null ? Number(row.qa_score) : null,
    confidence_pct: row.confidence_pct != null ? Number(row.confidence_pct) : null,
    verdict: row.verdict ? (String(row.verdict) as QaDocumentValidation["verdict"]) : null,
    estimated_review_minutes:
      row.estimated_review_minutes != null ? Number(row.estimated_review_minutes) : null,
    layer_results: (row.layer_results as Record<string, unknown>) ?? {},
    ai_review: (row.ai_review as Record<string, unknown>) ?? {},
    issues: Array.isArray(row.issues) ? (row.issues as QaValidationIssue[]) : [],
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function listDocumentValidations(limit = 100): Promise<QaDocumentValidation[]> {
  if (!isSupabaseConfigured()) {
    return [...memoryValidations]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_document_validations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isQaCenterTableUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapRow(row));
}

export async function getDocumentValidation(id: string): Promise<QaDocumentValidation | null> {
  if (!isSupabaseConfigured()) {
    return memoryValidations.find((v) => v.id === id) ?? null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_document_validations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isQaCenterTableUnavailable(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapRow(data) : null;
}

export async function countQueuedValidations(): Promise<number> {
  const all = await listDocumentValidations(500);
  return all.filter((v) => v.status === "queued" || v.status === "processing").length;
}

export async function createDocumentValidation(input: {
  id?: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  upload_batch_id: string;
  manufacturer?: string | null;
  created_by?: string | null;
}): Promise<QaDocumentValidation> {
  const id = input.id ?? randomUUID();
  const row = {
    id,
    status: "queued" as const,
    upload_batch_id: input.upload_batch_id,
    file_name: input.file_name,
    storage_path: input.storage_path,
    file_size: input.file_size,
    mime_type: input.mime_type,
    manufacturer: input.manufacturer ?? null,
    created_by: input.created_by ?? null,
    created_at: ts(),
    layer_results: {},
    ai_review: {},
    issues: [],
  };

  if (!isSupabaseConfigured()) {
    const doc = mapRow({ ...row, completed_at: null });
    memoryValidations.unshift(doc);
    return doc;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_document_validations")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    if (isQaCenterTableUnavailable(error)) throw new Error(qaCenterTablesMissingMessage());
    throw new Error(error.message);
  }
  return mapRow(data);
}

export async function updateDocumentValidation(
  id: string,
  patch: Partial<{
    status: QaDocumentValidation["status"];
    qa_score: number | null;
    confidence_pct: number | null;
    verdict: QaDocumentValidation["verdict"];
    estimated_review_minutes: number | null;
    layer_results: Record<string, unknown>;
    ai_review: Record<string, unknown>;
    issues: QaValidationIssue[];
    completed_at: string | null;
    manufacturer: string | null;
  }>
): Promise<QaDocumentValidation | null> {
  if (!isSupabaseConfigured()) {
    const idx = memoryValidations.findIndex((v) => v.id === id);
    if (idx < 0) return null;
    memoryValidations[idx] = { ...memoryValidations[idx], ...patch };
    return memoryValidations[idx];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qa_document_validations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (isQaCenterTableUnavailable(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapRow(data) : null;
}

export async function getValidationStats(): Promise<{
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  critical: number;
  avgScore: number | null;
  queued: number;
}> {
  const all = await listDocumentValidations(500);
  const completed = all.filter((v) => v.status === "completed");
  const scores = completed.map((v) => v.qa_score).filter((s): s is number => s != null);
  return {
    total: all.length,
    passed: completed.filter((v) => v.verdict === "pass").length,
    warnings: completed.filter((v) => v.verdict === "warning").length,
    failed: completed.filter((v) => v.verdict === "fail").length,
    critical: completed.filter((v) => v.verdict === "critical").length,
    avgScore:
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
    queued: all.filter((v) => v.status === "queued" || v.status === "processing").length,
  };
}
