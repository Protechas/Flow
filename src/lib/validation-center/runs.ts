import { randomUUID } from "node:crypto";
import { cache } from "react";
import { after } from "next/server";
import { initFlowStore } from "@/lib/data/flow-store";
import { deliverNotification } from "@/lib/notifications/notifications";
import { isValidationDbEnabled } from "@/lib/validation-center/validation-persistence";
import { loadDesktopSiLibrarySettings } from "@/lib/validation-center/desktop-settings";
import { DEFAULT_SI_LIBRARY_AUDIT_SETTINGS } from "@/lib/validation-center/default-settings";
import {
  getValidationFindingStats,
  importFindingsFromJobResult,
  listValidationFindings,
} from "@/lib/validation-center/findings";
import {
  isValidationEngineAvailable,
  runSiLibraryAuditJob,
} from "@/lib/validation-center/python-runner";
import {
  addMemoryFile,
  buildRunSummaryFromJobResult,
  enrichRunView,
  getMemoryEngineSettings,
  getMemoryFile,
  getMemoryRun,
  listMemoryFilesForRun,
  listMemoryRuns,
  getMemoryJobForRun,
  setMemoryEngineSettings,
  updateMemoryJobStatus,
  updateMemoryRunStatus,
  upsertMemoryJob,
  upsertMemoryRun,
} from "@/lib/validation-center/store";
import type {
  SiLibraryAuditSettings,
  ValidationEngineId,
  ValidationJob,
  ValidationRun,
  ValidationRunView,
  ValidationStoredFile,
} from "@/lib/validation-center/types";
import {
  persistValidationJobUpdate,
  persistValidationRun,
  persistValidationSettings,
  persistValidationStoredFiles,
  invalidateValidationHydration,
} from "@/lib/validation-center/validation-center-db";
import {
  ensurePendingJobsRunning,
  scheduleValidationJob,
  VALIDATION_JOB_TIMEOUT_MS,
} from "@/lib/validation-center/validation-job-runner";

const BUCKET = "validation-files";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Read paths want fresh run/job state, but a single page render calls several
 * of them (runs list, KPIs, findings) — dedupe the force-refresh per request
 * so one render hydrates from the DB exactly once.
 */
const refreshValidationCenterForRead = cache(async (): Promise<void> => {
  const { hydrateValidationCenterFromDb } = await import(
    "@/lib/validation-center/validation-center-db"
  );
  invalidateValidationHydration();
  await hydrateValidationCenterFromDb();
});

function ts() {
  return new Date().toISOString();
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

function excelMime() {
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export async function listValidationRuns(): Promise<ValidationRunView[]> {
  if (isValidationDbEnabled()) {
    await refreshValidationCenterForRead();
    await ensurePendingJobsRunning();
    const { listRunsFromDb } = await import("@/lib/validation-center/validation-center-db");
    return listRunsFromDb();
  }
  return listMemoryRuns().map(enrichRunView);
}

export async function getValidationRun(id: string): Promise<ValidationRunView | null> {
  if (isValidationDbEnabled()) {
    const { getRunFromDb } = await import("@/lib/validation-center/validation-center-db");
    await refreshValidationCenterForRead();
    await ensurePendingJobsRunning(id);
    return getRunFromDb(id);
  }
  const run = getMemoryRun(id);
  return run ? enrichRunView(run) : null;
}

export async function getValidationFileBuffer(file: ValidationStoredFile): Promise<Buffer> {
  if (file.file_data_base64) {
    return Buffer.from(file.file_data_base64, "base64");
  }
  if (isValidationDbEnabled()) {
    const { downloadValidationFileFromStorage } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    return downloadValidationFileFromStorage(file.storage_path);
  }
  throw new Error("File data unavailable");
}

export async function getValidationFileById(fileId: string): Promise<ValidationStoredFile | null> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }
  return getMemoryFile(fileId);
}

export async function getSiLibrarySettings(): Promise<SiLibraryAuditSettings> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }
  const raw = getMemoryEngineSettings("si_library_audit");
  const desktop = loadDesktopSiLibrarySettings();
  return {
    ...DEFAULT_SI_LIBRARY_AUDIT_SETTINGS,
    ...(desktop ?? {}),
    ...(raw as Partial<SiLibraryAuditSettings>),
  };
}

export async function saveSiLibrarySettings(
  settings: SiLibraryAuditSettings,
  updatedBy: string
): Promise<void> {
  setMemoryEngineSettings("si_library_audit", { ...settings });
  if (isValidationDbEnabled()) {
    await persistValidationSettings("si_library_audit", { ...settings }, updatedBy);
  }
}

type UploadedFile = { name: string; buffer: Buffer; mime_type: string };

const ACTIVE_ENGINES: ValidationEngineId[] = [
  "si_library_audit",
  "si_library_external",
  "id3_validation",
  "qa_engine",
];

export async function createValidationRun(input: {
  engine_id: ValidationEngineId;
  created_by: string;
  /** Required for si_library_audit, id3_validation, and qa_engine. */
  mc_file?: UploadedFile | null;
  /** SI audit: OneDrive export. Library validation: the report. ID3: the rules workbook (unless saved rules). */
  export_file?: UploadedFile | null;
  /** QA Engine: additional reference workbooks. */
  reference_files?: UploadedFile[];
  /** ID3: compare against the saved rules table instead of an uploaded workbook. */
  use_saved_rules?: boolean;
}): Promise<ValidationRunView> {
  if (!ACTIVE_ENGINES.includes(input.engine_id)) {
    throw new Error("This validation engine is not available yet");
  }
  if (input.engine_id !== "si_library_external" && !input.mc_file) {
    throw new Error("Manufacturer chart file is required for this engine");
  }
  const id3SavedRules = input.engine_id === "id3_validation" && input.use_saved_rules === true;
  const exportRequired = input.engine_id !== "qa_engine" && !id3SavedRules;
  if (exportRequired && !input.export_file) {
    throw new Error("Missing a required input file");
  }
  const allUploads = [
    ...(input.mc_file ? [input.mc_file] : []),
    ...(input.export_file ? [input.export_file] : []),
    ...(input.reference_files ?? []),
  ];
  if (allUploads.some((f) => f.buffer.length > MAX_UPLOAD_BYTES)) {
    throw new Error("Each upload must be 50 MB or smaller");
  }

  const runId = randomUUID();
  const jobId = randomUUID();
  const settings = await getSiLibrarySettings();
  const now = ts();

  const run: ValidationRun = {
    id: runId,
    engine_id: input.engine_id,
    status: "pending",
    manufacturer: null,
    title:
      input.engine_id === "si_library_external"
        ? `Library Validation — ${input.export_file!.name}`
        : input.engine_id === "id3_validation"
          ? `ID³ Validation — ${input.mc_file!.name}`
          : input.engine_id === "qa_engine"
            ? `QA Engine Scan — ${input.mc_file!.name}`
            : `SI Library Audit — ${input.mc_file!.name}`,
    compliance_rate: null,
    run_summary: {
      engine_id: input.engine_id,
      manufacturer: null,
      compliance_rate: null,
      expected_deliverables: null,
      passing_compliance: null,
      needs_review: null,
      executive_summary: null,
    },
    settings_snapshot: { ...settings },
    error_message: null,
    prior_run_id: null,
    project_id: null,
    created_by: input.created_by,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  const mcFile = input.mc_file
    ? await storeInputFile(runId, "manufacturer_chart", input.mc_file)
    : null;
  const exportFile = input.export_file
    ? await storeInputFile(runId, "onedrive_export", input.export_file)
    : null;
  const referenceFiles = [];
  for (const ref of input.reference_files ?? []) {
    referenceFiles.push(await storeInputFile(runId, "qa_reference", ref));
  }
  const inputFiles = [
    ...(mcFile ? [mcFile] : []),
    ...(exportFile ? [exportFile] : []),
    ...referenceFiles,
  ];

  const job: ValidationJob = {
    id: jobId,
    run_id: runId,
    engine_id: input.engine_id,
    status: "pending",
    payload: {
      ...(mcFile ? { mc_file_id: mcFile.id } : {}),
      ...(exportFile ? { export_file_id: exportFile.id } : {}),
      ...(id3SavedRules ? { use_saved_rules: true } : {}),
    },
    result: null,
    error_message: null,
    attempts: 0,
    created_at: now,
    started_at: null,
    completed_at: null,
  };

  upsertMemoryRun(run);
  upsertMemoryJob(job);

  if (isValidationDbEnabled()) {
    await persistValidationRun(run, inputFiles, job);
  }

  after(() => {
    scheduleValidationJob(runId);
  });

  return enrichRunView(run);
}

async function storeInputFile(
  runId: string,
  role: "manufacturer_chart" | "onedrive_export" | "qa_reference",
  file: { name: string; buffer: Buffer; mime_type: string }
): Promise<ValidationStoredFile> {
  const id = randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${runId}/${role}/${id}-${safeName}`;
  const stored: ValidationStoredFile = {
    id,
    run_id: runId,
    role,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.buffer.length,
    mime_type: file.mime_type || excelMime(),
    created_at: ts(),
    file_data_base64: file.buffer.toString("base64"),
  };
  addMemoryFile(stored);
  return stored;
}

async function storeArtifactFile(
  runId: string,
  role: "output_workbook" | "output_pdf",
  file: { name: string; buffer: Buffer; mime_type: string }
): Promise<ValidationStoredFile> {
  const id = randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${runId}/${role}/${id}-${safeName}`;
  const stored: ValidationStoredFile = {
    id,
    run_id: runId,
    role,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.buffer.length,
    mime_type: file.mime_type,
    created_at: ts(),
    file_data_base64: file.buffer.toString("base64"),
  };
  addMemoryFile(stored);
  return stored;
}

export async function processValidationJob(runId: string): Promise<void> {
  const run = getMemoryRun(runId);
  if (!run || run.status === "completed" || run.status === "failed") return;

  const job = getMemoryJobForRun(runId);
  if (!job) return;

  if (job.status === "processing" && job.started_at) {
    const elapsed = Date.now() - new Date(job.started_at).getTime();
    if (elapsed < VALIDATION_JOB_TIMEOUT_MS) return;
  }
  if (job.status === "completed") return;
  const files = listMemoryFilesForRun(runId);
  const mcFile = files.find((f) => f.role === "manufacturer_chart");
  const exportFile = files.find((f) => f.role === "onedrive_export");
  const referenceFiles = files.filter((f) => f.role === "qa_reference");
  const usesSavedRules = job.payload?.use_saved_rules === true;
  const needsMcChart = run.engine_id !== "si_library_external";
  const needsExport =
    run.engine_id !== "qa_engine" && !(run.engine_id === "id3_validation" && usesSavedRules);
  if ((needsMcChart && !mcFile) || (needsExport && !exportFile)) {
    const message = "Missing input files for job";
    updateMemoryRunStatus(runId, "failed", { error_message: message });
    updateMemoryJobStatus(job.id, "failed", {
      error_message: message,
      completed_at: ts(),
    });
    if (isValidationDbEnabled()) {
      await persistValidationJobUpdate(job.id, "failed", {
        error_message: message,
        completed_at: ts(),
      });
    }
    return;
  }

  // Check the engine BEFORE claiming the job. Vercel has no Python — jobs
  // enqueued in production stay pending until the audit worker (a machine
  // running `npm run audit-worker` with the engine installed) picks them up.
  const engineReady = await isValidationEngineAvailable();
  if (!engineReady) {
    console.warn(
      `[validation] engine unavailable on this server — leaving job ${job.id} queued for the audit worker`
    );
    return;
  }

  const started = ts();
  updateMemoryRunStatus(runId, "processing", { started_at: started });
  updateMemoryJobStatus(job.id, "processing", {
    started_at: started,
    attempts: job.attempts + 1,
  });

  if (isValidationDbEnabled()) {
    await persistValidationJobUpdate(job.id, "processing", {
      started_at: started,
      attempts: job.attempts + 1,
    });
  }

  try {
    const exportBuffer = exportFile ? await getValidationFileBuffer(exportFile) : null;

    let result;
    if (run.engine_id === "si_library_external") {
      // Library validation checks the uploaded report against the audited
      // library — the latest completed audit workbook per manufacturer.
      const audits = await collectLatestAuditWorkbooks();
      if (audits.length === 0) {
        await failJob(
          runId,
          job.id,
          "No completed SI Library Audits in the repository yet — run at least one audit first."
        );
        return;
      }
      result = await runSiLibraryAuditJob({
        job_type: "library_validation",
        export_bytes_b64: exportBuffer!.toString("base64"),
        export_filename: exportFile!.file_name,
        audits,
      });
    } else if (run.engine_id === "id3_validation") {
      // ID3: compare the manufacturer chart against the rules — either the
      // uploaded workbook (export slot) or the saved rules table.
      const mcBuffer = await getValidationFileBuffer(mcFile!);
      if (usesSavedRules) {
        const { listId3Rules } = await import("@/lib/validation-center/id3-rules");
        const rules = await listId3Rules();
        if (rules.length === 0) {
          await failJob(runId, job.id, "No saved ID3 rules yet — add rules or upload a rules workbook.");
          return;
        }
        result = await runSiLibraryAuditJob({
          job_type: "id3_validation",
          mc_bytes_b64: mcBuffer.toString("base64"),
          mc_filename: mcFile!.file_name,
          rules_records: rules.map((r) => r.fields),
        });
      } else {
        result = await runSiLibraryAuditJob({
          job_type: "id3_validation",
          mc_bytes_b64: mcBuffer.toString("base64"),
          rules_bytes_b64: exportBuffer!.toString("base64"),
          mc_filename: mcFile!.file_name,
          rules_filename: exportFile!.file_name,
        });
      }
    } else if (run.engine_id === "qa_engine") {
      // QA Engine: scan the MC chart plus every reference workbook.
      const payloadFiles: { name: string; bytes_b64: string; is_chart: boolean }[] = [];
      const mcBuffer = await getValidationFileBuffer(mcFile!);
      payloadFiles.push({
        name: mcFile!.file_name,
        bytes_b64: mcBuffer.toString("base64"),
        is_chart: true,
      });
      for (const ref of referenceFiles) {
        const buf = await getValidationFileBuffer(ref);
        payloadFiles.push({ name: ref.file_name, bytes_b64: buf.toString("base64"), is_chart: false });
      }
      result = await runSiLibraryAuditJob({
        job_type: "qa_engine_scan",
        files: payloadFiles,
      });
    } else {
      const mcBuffer = await getValidationFileBuffer(mcFile!);
      result = await runSiLibraryAuditJob({
        mc_bytes_b64: mcBuffer.toString("base64"),
        export_bytes_b64: exportBuffer!.toString("base64"),
        mc_filename: mcFile!.file_name,
        export_filename: exportFile!.file_name,
        settings_snapshot: run.settings_snapshot,
      });
    }

    if (result.status === "failed" || result.error) {
      await failJob(runId, job.id, result.error ?? "Audit engine returned failure");
      return;
    }

    const summary = buildRunSummaryFromJobResult(result as unknown as Record<string, unknown>);
    const manufacturer = summary.manufacturer;
    const compliance = summary.compliance_rate;

    const artifactFiles: ValidationStoredFile[] = [];
    if (result.workbook_b64) {
      artifactFiles.push(
        await storeArtifactFile(runId, "output_workbook", {
          name: result.workbook_filename ?? "audit_output.xlsx",
          buffer: Buffer.from(result.workbook_b64, "base64"),
          mime_type: excelMime(),
        })
      );
    }
    if (result.pdf_b64) {
      artifactFiles.push(
        await storeArtifactFile(runId, "output_pdf", {
          name: result.pdf_filename ?? "Executive_Audit_Summary.pdf",
          buffer: Buffer.from(result.pdf_b64, "base64"),
          mime_type: "application/pdf",
        })
      );
    }

    const rawFindings = Array.isArray(result.findings) ? result.findings : [];
    await importFindingsFromJobResult(runId, run.engine_id, rawFindings);

    // QA Engine findings land in their own reviewable table.
    const qaFindings = (result as unknown as { qa_findings?: unknown }).qa_findings;
    if (run.engine_id === "qa_engine" && Array.isArray(qaFindings)) {
      const { importQaEngineFindings } = await import("@/lib/validation-center/qa-engine-findings");
      await importQaEngineFindings(runId, qaFindings as Record<string, unknown>[]);
    }

    const completed = ts();
    updateMemoryJobStatus(job.id, "completed", {
      result: result as unknown as Record<string, unknown>,
      completed_at: completed,
      error_message: null,
    });
    updateMemoryRunStatus(runId, "completed", {
      manufacturer,
      title: manufacturer ? `SI Library Audit — ${manufacturer}` : run.title,
      compliance_rate: compliance,
      run_summary: summary,
      completed_at: completed,
      error_message: null,
    });

    if (isValidationDbEnabled()) {
      if (artifactFiles.length > 0) {
        await persistValidationStoredFiles(artifactFiles);
      }
      await persistValidationJobUpdate(job.id, "completed", {
        result: result as unknown as Record<string, unknown>,
        completed_at: completed,
      });
    }

    notifyRunComplete(run.created_by, runId, manufacturer, compliance);
  } catch (err) {
    await failJob(runId, job.id, err instanceof Error ? err.message : "Validation job failed");
  }
}

/** Latest completed audit workbook per manufacturer — the "audited library" a validation checks against. */
async function collectLatestAuditWorkbooks(): Promise<
  { manufacturer: string; workbook_b64: string }[]
> {
  const completedAudits = listMemoryRuns().filter(
    (r) => r.engine_id === "si_library_audit" && r.status === "completed" && r.manufacturer
  );
  const latest = new Map<string, (typeof completedAudits)[number]>();
  for (const r of completedAudits) {
    const key = r.manufacturer!;
    const current = latest.get(key);
    if (!current || (r.completed_at ?? "") > (current.completed_at ?? "")) {
      latest.set(key, r);
    }
  }

  const audits: { manufacturer: string; workbook_b64: string }[] = [];
  for (const [manufacturer, auditRun] of latest) {
    const workbook = listMemoryFilesForRun(auditRun.id).find(
      (f) => f.role === "output_workbook"
    );
    if (!workbook) continue;
    try {
      const buffer = await getValidationFileBuffer(workbook);
      audits.push({ manufacturer, workbook_b64: buffer.toString("base64") });
    } catch {
      // Workbook missing from storage — skip this manufacturer rather than fail the run.
    }
  }
  return audits;
}

async function failJob(runId: string, jobId: string, message: string) {
  const completed = ts();
  updateMemoryJobStatus(jobId, "failed", {
    error_message: message,
    completed_at: completed,
  });
  updateMemoryRunStatus(runId, "failed", {
    error_message: message,
    completed_at: completed,
  });
  if (isValidationDbEnabled()) {
    await persistValidationJobUpdate(jobId, "failed", {
      error_message: message,
      completed_at: completed,
    });
  }
}

function notifyRunComplete(
  userId: string,
  runId: string,
  manufacturer: string | null,
  compliance: number | null
) {
  initFlowStore();
  const rateLabel = compliance != null ? `${compliance}%` : "—";
  deliverNotification({
    user_id: userId,
    type: "validation_run_complete",
    title: "Validation run complete",
    message: `${manufacturer ?? "Audit"} finished — ${rateLabel} compliance`,
    related_entity_type: "validation_run",
    related_entity_id: runId,
    link: `/qa-center/validation/runs/${runId}`,
  });
}

export async function getValidationDashboardStats(runs: ValidationRunView[]) {
  const completed = runs.filter((r) => r.status === "completed");
  const rates = completed
    .map((r) => r.compliance_rate)
    .filter((v): v is number => v != null);
  const avgAccuracy =
    rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10 : null;

  const allFindings = await listValidationFindings();
  const findingStats = getValidationFindingStats(allFindings);

  return {
    libraryAccuracy: avgAccuracy,
    openFindings: findingStats.open,
    criticalFindings: findingStats.criticalOpen,
    completedRuns: completed.length,
    totalFindings: findingStats.total,
  };
}

export async function linkValidationRevalidation(
  followUpRunId: string,
  priorRunId: string
): Promise<ValidationRun | null> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }

  const run = getMemoryRun(followUpRunId);
  if (!run) return null;

  const updated: ValidationRun = {
    ...run,
    prior_run_id: priorRunId,
    updated_at: ts(),
  };
  upsertMemoryRun(updated);

  if (isValidationDbEnabled()) {
    const { persistValidationRunLink } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await persistValidationRunLink(followUpRunId, { prior_run_id: priorRunId });
  }

  return updated;
}

export async function getValidationCenterKpis() {
  const runs = await listValidationRuns();
  const findings = await listValidationFindings();
  const { computeValidationCenterKpis } = await import("@/lib/validation-center/kpi-engine");
  return computeValidationCenterKpis(runs, findings);
}

export async function getProjectValidationMetricsForProject(projectId: string) {
  const runs = await listValidationRuns();
  const findings = await listValidationFindings();
  const { getProjectValidationMetrics } = await import("@/lib/validation-center/kpi-engine");
  return getProjectValidationMetrics(projectId, runs, findings);
}

export { BUCKET };
