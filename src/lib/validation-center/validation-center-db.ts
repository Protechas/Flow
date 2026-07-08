import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/** Validation writes come from user actions AND the headless audit worker —
 * prefer the service-role client so the worker (no session) passes RLS. */
async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}
import { isValidationDbEnabled } from "@/lib/validation-center/validation-persistence";
import {
  enrichRunView,
  getMemoryRun,
  setMemoryEngineSettings,
  setValidationMemoryState,
  listMemoryRuns,
} from "@/lib/validation-center/store";
import { buildFindingSearchText } from "@/lib/validation-center/finding-mapper";
import type {
  ValidationEngineId,
  ValidationFinding,
  ValidationFindingTaskBridge,
  ValidationJob,
  ValidationJobStatus,
  ValidationRun,
  ValidationRunView,
  ValidationStoredFile,
} from "@/lib/validation-center/types";
import {
  setValidationBridgeMemoryState,
} from "@/lib/validation-center/task-bridge";

const BUCKET = "validation-files";
let hydrated = false;

export function invalidateValidationHydration(): void {
  hydrated = false;
}

function mapRun(row: Record<string, unknown>): ValidationRun {
  const summary = (row.run_summary ?? {}) as ValidationRun["run_summary"];
  return {
    id: String(row.id),
    engine_id: String(row.engine_id) as ValidationEngineId,
    status: String(row.status) as ValidationRun["status"],
    manufacturer: row.manufacturer != null ? String(row.manufacturer) : null,
    title: row.title != null ? String(row.title) : null,
    compliance_rate: row.compliance_rate != null ? Number(row.compliance_rate) : null,
    run_summary: summary,
    settings_snapshot: (row.settings_snapshot ?? {}) as Record<string, unknown>,
    error_message: row.error_message != null ? String(row.error_message) : null,
    prior_run_id: row.prior_run_id != null ? String(row.prior_run_id) : null,
    project_id: row.project_id != null ? String(row.project_id) : null,
    created_by: String(row.created_by),
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapFile(row: Record<string, unknown>): ValidationStoredFile {
  return {
    id: String(row.id),
    run_id: String(row.run_id),
    role: String(row.role) as ValidationStoredFile["role"],
    file_name: String(row.file_name),
    storage_path: String(row.storage_path),
    file_size: Number(row.file_size ?? 0),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    created_at: String(row.created_at),
  };
}

function mapJob(row: Record<string, unknown>): ValidationJob {
  return {
    id: String(row.id),
    run_id: String(row.run_id),
    engine_id: String(row.engine_id) as ValidationEngineId,
    status: String(row.status) as ValidationJob["status"],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    result: row.result ? (row.result as Record<string, unknown>) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    attempts: Number(row.attempts ?? 0),
    created_at: String(row.created_at),
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
  };
}

function mapFinding(row: Record<string, unknown>): ValidationFinding {
  return {
    id: String(row.id),
    validation_run_id: String(row.validation_run_id),
    engine_id: String(row.engine_id) as ValidationEngineId,
    title: String(row.title),
    severity: String(row.severity) as ValidationFinding["severity"],
    status: String(row.status) as ValidationFinding["status"],
    root_cause: String(row.root_cause) as ValidationFinding["root_cause"],
    confidence_score: Number(row.confidence_score ?? 0),
    suggested_correction: String(row.suggested_correction ?? ""),
    manufacturer: row.manufacturer != null ? String(row.manufacturer) : null,
    match_status: row.match_status != null ? String(row.match_status) : null,
    affected_record_ref: (row.affected_record_ref ?? {}) as Record<string, unknown>,
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    work_item_id: row.work_item_id != null ? String(row.work_item_id) : null,
    qa_status:
      row.qa_status != null ? (String(row.qa_status) as ValidationFinding["qa_status"]) : null,
    resolution_date: row.resolution_date != null ? String(row.resolution_date) : null,
    prior_finding_id:
      row.prior_finding_id != null ? String(row.prior_finding_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapBridge(row: Record<string, unknown>): ValidationFindingTaskBridge {
  return {
    id: String(row.id),
    validation_finding_id: String(row.validation_finding_id),
    work_item_id: String(row.work_item_id),
    batch_id: row.batch_id != null ? String(row.batch_id) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  };
}

const JOB_META_COLUMNS =
  "id, run_id, engine_id, status, error_message, attempts, created_at, started_at, completed_at";

/**
 * Job payload/result blobs run hundreds of KB each and nothing reads them for
 * finished jobs, so hydrate metadata only — unfinished jobs keep full rows
 * because the runner resumes from their payload.
 */
async function fetchJobsSlim(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [metaRes, activeRes] = await Promise.all([
    supabase.from("validation_jobs").select(JOB_META_COLUMNS),
    supabase.from("validation_jobs").select("*").in("status", ["pending", "processing"]),
  ]);
  if (metaRes.error) return { data: null, error: metaRes.error };
  if (activeRes.error) return { data: null, error: activeRes.error };
  const fullById = new Map(
    (activeRes.data ?? []).map((r) => [String((r as Record<string, unknown>).id), r])
  );
  const data = (metaRes.data ?? []).map(
    (r) => fullById.get(String((r as Record<string, unknown>).id)) ?? r
  );
  return { data, error: null };
}

/** PostgREST caps one response at 1000 rows; page in parallel so every finding hydrates. */
async function fetchAllFindings(supabase: Awaited<ReturnType<typeof createClient>>) {
  const pageSize = 1000;
  const { count, error: countError } = await supabase
    .from("validation_findings")
    .select("*", { count: "exact", head: true });
  if (countError) return { data: null, error: countError };
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from("validation_findings")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(i * pageSize, (i + 1) * pageSize - 1)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { data: null, error: failed.error };
  return { data: results.flatMap((r) => r.data ?? []), error: null };
}

export async function hydrateValidationCenterFromDb(force = false): Promise<void> {
  if (!isValidationDbEnabled()) return;
  if (hydrated && !force) return;

  const supabase = await dbClient();
  const [runsRes, filesRes, jobsRes, settingsRes, findingsRes, bridgesRes] = await Promise.all([
    supabase.from("validation_runs").select("*").order("created_at", { ascending: false }),
    supabase.from("validation_files").select("*"),
    fetchJobsSlim(supabase),
    supabase.from("validation_settings").select("*"),
    fetchAllFindings(supabase),
    supabase.from("validation_finding_tasks").select("*"),
  ]);

  if (runsRes.error) throw new Error(runsRes.error.message);
  if (filesRes.error) throw new Error(filesRes.error.message);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (findingsRes.error) throw new Error(findingsRes.error.message);

  const runs = (runsRes.data ?? []).map((r) => mapRun(r as Record<string, unknown>));
  const files = (filesRes.data ?? []).map((r) => mapFile(r as Record<string, unknown>));
  const jobs = (jobsRes.data ?? []).map((r) => mapJob(r as Record<string, unknown>));
  const findings = (findingsRes.data ?? []).map((r) => mapFinding(r as Record<string, unknown>));
  const bridges = (bridgesRes.data ?? []).map((r) => mapBridge(r as Record<string, unknown>));
  const settings: Record<string, Record<string, unknown>> = {};
  for (const row of settingsRes.data ?? []) {
    const rec = row as Record<string, unknown>;
    settings[String(rec.engine_id)] = (rec.settings ?? {}) as Record<string, unknown>;
  }

  setValidationMemoryState({ runs, files, jobs, findings, settings });
  setValidationBridgeMemoryState(bridges);
  hydrated = true;
}

export function listRunsFromDb(): ValidationRunView[] {
  return listMemoryRuns().map(enrichRunView);
}

export function getRunFromDb(id: string): ValidationRunView | null {
  const run = getMemoryRun(id);
  return run ? enrichRunView(run) : null;
}

export async function persistValidationRun(
  run: ValidationRun,
  files: ValidationStoredFile[],
  job: ValidationJob
): Promise<void> {
  if (!isValidationDbEnabled()) return;

  const supabase = await dbClient();

  const { error: runError } = await supabase.from("validation_runs").insert({
    id: run.id,
    engine_id: run.engine_id,
    status: run.status,
    manufacturer: run.manufacturer,
    title: run.title,
    compliance_rate: run.compliance_rate,
    run_summary: run.run_summary,
    settings_snapshot: run.settings_snapshot,
    error_message: run.error_message,
    prior_run_id: run.prior_run_id,
    project_id: run.project_id,
    created_by: run.created_by,
    started_at: run.started_at,
    completed_at: run.completed_at,
    created_at: run.created_at,
    updated_at: run.updated_at,
  });
  if (runError) throw new Error(runError.message);

  for (const file of files) {
    const storagePath = file.storage_path;
    if (file.file_data_base64) {
      const buffer = Buffer.from(file.file_data_base64, "base64");
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.mime_type,
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { error: fileError } = await supabase.from("validation_files").insert({
      id: file.id,
      run_id: file.run_id,
      role: file.role,
      file_name: file.file_name,
      storage_path: storagePath,
      file_size: file.file_size,
      mime_type: file.mime_type,
      created_at: file.created_at,
    });
    if (fileError) throw new Error(fileError.message);
  }

  const { error: jobError } = await supabase.from("validation_jobs").insert({
    id: job.id,
    run_id: job.run_id,
    engine_id: job.engine_id,
    status: job.status,
    payload: job.payload,
    result: job.result,
    error_message: job.error_message,
    attempts: job.attempts,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  });
  if (jobError) throw new Error(jobError.message);
}

export async function persistValidationJobUpdate(
  jobId: string,
  status: ValidationJobStatus,
  patch: Partial<ValidationJob> = {}
): Promise<void> {
  if (!isValidationDbEnabled()) return;

  const supabase = await dbClient();
  const { error } = await supabase
    .from("validation_jobs")
    .update({ status, ...patch })
    .eq("id", jobId);
  if (error) throw new Error(error.message);

  const { getValidationMemoryState } = await import("@/lib/validation-center/store");
  const job = getValidationMemoryState().memoryJobs.find((j) => j.id === jobId);
  if (!job) return;

  const memRun = getMemoryRun(job.run_id);
  if (!memRun) return;

  const { error: runError } = await supabase
    .from("validation_runs")
    .update({
      status: memRun.status,
      manufacturer: memRun.manufacturer,
      title: memRun.title,
      compliance_rate: memRun.compliance_rate,
      run_summary: memRun.run_summary,
      error_message: memRun.error_message,
      started_at: memRun.started_at,
      completed_at: memRun.completed_at,
      updated_at: memRun.updated_at,
    })
    .eq("id", memRun.id);
  if (runError) throw new Error(runError.message);
}

export async function persistValidationSettings(
  engineId: ValidationEngineId,
  settings: Record<string, unknown>,
  updatedBy: string
): Promise<void> {
  if (!isValidationDbEnabled()) return;
  const supabase = await dbClient();
  const { error } = await supabase.from("validation_settings").upsert({
    engine_id: engineId,
    settings,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  setMemoryEngineSettings(engineId, settings);
}

export async function downloadValidationFileFromStorage(storagePath: string): Promise<Buffer> {
  const supabase = await dbClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Download failed");
  return Buffer.from(await data.arrayBuffer());
}

export async function persistValidationFindings(
  runId: string,
  findings: ValidationFinding[]
): Promise<void> {
  if (!isValidationDbEnabled()) return;

  const supabase = await dbClient();
  const { error: deleteError } = await supabase
    .from("validation_findings")
    .delete()
    .eq("validation_run_id", runId);
  if (deleteError) throw new Error(deleteError.message);

  if (findings.length === 0) return;

  const rows = findings.map((f) => ({
    id: f.id,
    validation_run_id: f.validation_run_id,
    engine_id: f.engine_id,
    title: f.title,
    severity: f.severity,
    status: f.status,
    root_cause: f.root_cause,
    confidence_score: f.confidence_score,
    suggested_correction: f.suggested_correction,
    manufacturer: f.manufacturer,
    match_status: f.match_status,
    affected_record_ref: f.affected_record_ref,
    evidence: f.evidence,
    work_item_id: f.work_item_id,
    search_text: buildFindingSearchText({
      title: f.title,
      manufacturer: f.manufacturer,
      suggested_correction: f.suggested_correction,
      match_status: f.match_status,
      affected_record_ref: f.affected_record_ref,
    }),
    created_at: f.created_at,
    updated_at: f.updated_at,
  }));

  const { error } = await supabase.from("validation_findings").insert(rows);
  if (error) throw new Error(error.message);
}

export async function persistValidationFindingFullUpdate(finding: ValidationFinding): Promise<void> {
  if (!isValidationDbEnabled()) return;

  const supabase = await dbClient();
  const { error } = await supabase
    .from("validation_findings")
    .update({
      status: finding.status,
      root_cause: finding.root_cause,
      work_item_id: finding.work_item_id,
      qa_status: finding.qa_status,
      resolution_date: finding.resolution_date,
      updated_at: finding.updated_at,
      search_text: buildFindingSearchText({
        title: finding.title,
        manufacturer: finding.manufacturer,
        suggested_correction: finding.suggested_correction,
        match_status: finding.match_status,
        affected_record_ref: finding.affected_record_ref,
      }),
    })
    .eq("id", finding.id);
  if (error) throw new Error(error.message);
}

export async function persistFindingTaskLink(
  finding: ValidationFinding,
  bridge: ValidationFindingTaskBridge
): Promise<void> {
  if (!isValidationDbEnabled()) return;

  const supabase = await dbClient();
  await persistValidationFindingFullUpdate(finding);

  const { error } = await supabase.from("validation_finding_tasks").insert({
    id: bridge.id,
    validation_finding_id: bridge.validation_finding_id,
    work_item_id: bridge.work_item_id,
    batch_id: bridge.batch_id,
    created_by: bridge.created_by,
    created_at: bridge.created_at,
  });
  if (error) throw new Error(error.message);
}

export async function persistValidationFindingUpdate(
  finding: ValidationFinding
): Promise<void> {
  await persistValidationFindingFullUpdate(finding);
}

export async function persistValidationStoredFiles(
  files: ValidationStoredFile[]
): Promise<void> {
  if (!isValidationDbEnabled() || files.length === 0) return;

  const supabase = await dbClient();

  for (const file of files) {
    const storagePath = file.storage_path;
    if (file.file_data_base64) {
      const buffer = Buffer.from(file.file_data_base64, "base64");
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.mime_type,
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { error: fileError } = await supabase.from("validation_files").upsert(
      {
        id: file.id,
        run_id: file.run_id,
        role: file.role,
        file_name: file.file_name,
        storage_path: storagePath,
        file_size: file.file_size,
        mime_type: file.mime_type,
        created_at: file.created_at,
      },
      { onConflict: "id" }
    );
    if (fileError) throw new Error(fileError.message);
  }
}

export async function persistValidationRunLink(
  runId: string,
  patch: { prior_run_id?: string | null; project_id?: string | null }
): Promise<void> {
  if (!isValidationDbEnabled()) return;

  const supabase = await dbClient();
  const { error } = await supabase
    .from("validation_runs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}
