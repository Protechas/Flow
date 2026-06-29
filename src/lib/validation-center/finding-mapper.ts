import { randomUUID } from "node:crypto";
import type {
  ValidationEngineId,
  ValidationFinding,
  ValidationFindingSeverity,
  ValidationRootCause,
} from "@/lib/validation-center/types";

const OPEN_STATUSES = new Set(["open", "in_review", "task_created"]);

export function buildFindingSearchText(input: {
  title: string;
  manufacturer: string | null;
  suggested_correction: string;
  match_status: string | null;
  affected_record_ref: Record<string, unknown>;
}): string {
  const parts = [
    input.title,
    input.manufacturer ?? "",
    input.suggested_correction,
    input.match_status ?? "",
    JSON.stringify(input.affected_record_ref),
  ];
  return parts.join(" ").toLowerCase();
}

function parseSeverity(value: unknown): ValidationFindingSeverity {
  const s = String(value ?? "medium");
  if (s === "critical" || s === "high" || s === "medium" || s === "low" || s === "info") {
    return s;
  }
  return "medium";
}

function parseRootCause(value: unknown): ValidationRootCause {
  const valid: ValidationRootCause[] = [
    "library_issue",
    "oem_data_issue",
    "import_issue",
    "employee_error",
    "missing_data",
    "rule_mismatch",
    "system_logic_issue",
    "unknown",
    "needs_investigation",
  ];
  const s = String(value ?? "needs_investigation") as ValidationRootCause;
  return valid.includes(s) ? s : "needs_investigation";
}

export function mapEngineFindingToEntity(
  runId: string,
  engineId: ValidationEngineId,
  raw: Record<string, unknown>,
  now: string
): ValidationFinding {
  const title = String(raw.title ?? "Validation finding");
  const manufacturer = raw.manufacturer != null ? String(raw.manufacturer) : null;
  const suggested = String(raw.suggested_correction ?? "");
  const affected =
    raw.affected_record_ref && typeof raw.affected_record_ref === "object"
      ? (raw.affected_record_ref as Record<string, unknown>)
      : {};
  const evidence =
    raw.evidence && typeof raw.evidence === "object"
      ? (raw.evidence as Record<string, unknown>)
      : {};

  return {
    id: randomUUID(),
    validation_run_id: runId,
    engine_id: engineId,
    title,
    severity: parseSeverity(raw.severity),
    status: "open",
    root_cause: parseRootCause(raw.root_cause),
    confidence_score: Number(raw.confidence_score ?? 0),
    suggested_correction: suggested,
    manufacturer,
    match_status: raw.match_status != null ? String(raw.match_status) : null,
    affected_record_ref: affected,
    evidence,
    work_item_id: null,
    qa_status: null,
    resolution_date: null,
    prior_finding_id: null,
    created_at: now,
    updated_at: now,
  };
}

export function isOpenFinding(finding: ValidationFinding): boolean {
  return OPEN_STATUSES.has(finding.status);
}

export function isCriticalFinding(finding: ValidationFinding): boolean {
  return finding.severity === "critical" || finding.severity === "high";
}
