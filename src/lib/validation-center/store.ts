import { DEFAULT_SI_LIBRARY_AUDIT_SETTINGS } from "@/lib/validation-center/default-settings";
import type {
  ValidationEngineId,
  ValidationFileRole,
  ValidationFinding,
  ValidationJob,
  ValidationJobStatus,
  ValidationRun,
  ValidationRunStatus,
  ValidationRunSummary,
  ValidationRunView,
  ValidationStoredFile,
} from "@/lib/validation-center/types";

let memoryRuns: ValidationRun[] = [];
let memoryFiles: ValidationStoredFile[] = [];
let memoryJobs: ValidationJob[] = [];
let memoryFindings: ValidationFinding[] = [];
let memorySettings: Record<string, Record<string, unknown>> = {
  si_library_audit: { ...DEFAULT_SI_LIBRARY_AUDIT_SETTINGS },
};

export function getValidationMemoryState() {
  return { memoryRuns, memoryFiles, memoryJobs, memoryFindings, memorySettings };
}

export function setValidationMemoryState(state: {
  runs?: ValidationRun[];
  files?: ValidationStoredFile[];
  jobs?: ValidationJob[];
  findings?: ValidationFinding[];
  settings?: Record<string, Record<string, unknown>>;
}) {
  if (state.runs) memoryRuns = state.runs;
  if (state.files) memoryFiles = state.files;
  if (state.jobs) memoryJobs = state.jobs;
  if (state.findings) memoryFindings = state.findings;
  if (state.settings) memorySettings = state.settings;
}

export function resetValidationMemoryStore() {
  memoryRuns = [];
  memoryFiles = [];
  memoryJobs = [];
  memoryFindings = [];
  memorySettings = { si_library_audit: { ...DEFAULT_SI_LIBRARY_AUDIT_SETTINGS } };
}

export function listMemoryRuns(): ValidationRun[] {
  return [...memoryRuns].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMemoryRun(id: string): ValidationRun | null {
  return memoryRuns.find((r) => r.id === id) ?? null;
}

export function upsertMemoryRun(run: ValidationRun): void {
  const idx = memoryRuns.findIndex((r) => r.id === run.id);
  if (idx >= 0) memoryRuns[idx] = run;
  else memoryRuns.unshift(run);
}

export function listMemoryFilesForRun(runId: string): ValidationStoredFile[] {
  return memoryFiles.filter((f) => f.run_id === runId);
}

export function addMemoryFile(file: ValidationStoredFile): void {
  memoryFiles.push(file);
}

export function getMemoryFile(id: string): ValidationStoredFile | null {
  return memoryFiles.find((f) => f.id === id) ?? null;
}

export function getMemoryJobForRun(runId: string): ValidationJob | null {
  return memoryJobs.find((j) => j.run_id === runId) ?? null;
}

export function upsertMemoryJob(job: ValidationJob): void {
  const idx = memoryJobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) memoryJobs[idx] = job;
  else memoryJobs.push(job);
}

export function getMemoryEngineSettings(engineId: ValidationEngineId): Record<string, unknown> {
  return memorySettings[engineId] ?? { ...DEFAULT_SI_LIBRARY_AUDIT_SETTINGS };
}

export function setMemoryEngineSettings(
  engineId: ValidationEngineId,
  settings: Record<string, unknown>
): void {
  memorySettings[engineId] = settings;
}

export function enrichRunView(run: ValidationRun): ValidationRunView {
  const files = listMemoryFilesForRun(run.id);
  const job = getMemoryJobForRun(run.id);
  const findingsCount = countMemoryFindingsForRun(run.id);
  return {
    ...run,
    files,
    job_status: job?.status ?? null,
    findings_count: findingsCount,
  };
}

export function listMemoryFindings(): ValidationFinding[] {
  return [...memoryFindings].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listMemoryFindingsForRun(runId: string): ValidationFinding[] {
  return memoryFindings
    .filter((f) => f.validation_run_id === runId)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const sa = severityOrder[a.severity] ?? 5;
      const sb = severityOrder[b.severity] ?? 5;
      if (sa !== sb) return sa - sb;
      return a.title.localeCompare(b.title);
    });
}

export function countMemoryFindingsForRun(runId: string): number {
  return memoryFindings.filter((f) => f.validation_run_id === runId).length;
}

export function getMemoryFinding(id: string): ValidationFinding | null {
  return memoryFindings.find((f) => f.id === id) ?? null;
}

export function addMemoryFindings(findings: ValidationFinding[]): void {
  memoryFindings.push(...findings);
}

export function upsertMemoryFinding(finding: ValidationFinding): void {
  const idx = memoryFindings.findIndex((f) => f.id === finding.id);
  if (idx >= 0) memoryFindings[idx] = finding;
  else memoryFindings.unshift(finding);
}

export function removeMemoryFindingsForRun(runId: string): void {
  memoryFindings = memoryFindings.filter((f) => f.validation_run_id !== runId);
}

export function updateMemoryRunStatus(
  runId: string,
  status: ValidationRunStatus,
  patch: Partial<ValidationRun> = {}
): ValidationRun | null {
  const run = getMemoryRun(runId);
  if (!run) return null;
  const updated: ValidationRun = {
    ...run,
    ...patch,
    status,
    updated_at: new Date().toISOString(),
  };
  upsertMemoryRun(updated);
  return updated;
}

export function updateMemoryJobStatus(
  jobId: string,
  status: ValidationJobStatus,
  patch: Partial<ValidationJob> = {}
): ValidationJob | null {
  const job = memoryJobs.find((j) => j.id === jobId);
  if (!job) return null;
  const updated: ValidationJob = {
    ...job,
    ...patch,
    status,
  };
  upsertMemoryJob(updated);
  return updated;
}

export function buildRunSummaryFromJobResult(result: Record<string, unknown>): ValidationRunSummary {
  const summary = (result.run_summary ?? {}) as Record<string, unknown>;
  return {
    engine_id: String(summary.engine_id ?? "si_library_audit") as ValidationEngineId,
    manufacturer: summary.manufacturer != null ? String(summary.manufacturer) : null,
    compliance_rate:
      summary.compliance_rate != null ? Number(summary.compliance_rate) : null,
    expected_deliverables:
      summary.expected_deliverables != null ? Number(summary.expected_deliverables) : null,
    passing_compliance:
      summary.passing_compliance != null ? Number(summary.passing_compliance) : null,
    needs_review: summary.needs_review != null ? Number(summary.needs_review) : null,
    executive_summary:
      summary.executive_summary != null ? String(summary.executive_summary) : null,
    findings_preview: Array.isArray(result.findings)
      ? (result.findings as unknown[]).slice(0, 50)
      : [],
  };
}
