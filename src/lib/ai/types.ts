import type { ValidationRootCause } from "@/lib/validation-center/types";

/** One AI-suggested grouping of related findings. Advisory only. */
export interface AiTriageCluster {
  label: string;
  /** Plain-English explanation of what this group of findings means. */
  explanation: string;
  likely_root_cause: ValidationRootCause;
  /** What the analyst should do about this group. */
  recommended_action: string;
  priority: "now" | "next" | "later";
  finding_ids: string[];
}

export type AiTriageStatus = "completed" | "failed";

/** One advisory issue Eddy raised while reviewing a document. */
export interface AiSopReviewFinding {
  kind:
    | "clarity"
    | "contradiction"
    | "stale_reference"
    | "missing_step"
    | "inconsistency"
    | "other";
  severity: "high" | "medium" | "low";
  /** Short verbatim excerpt anchoring the issue in the document. */
  quote: string;
  issue: string;
  suggestion: string;
}

/** Result of one document review pass. Ephemeral — shown to the editor, not stored. */
export interface AiSopReviewResult {
  document_id: string;
  model: string;
  summary: string;
  findings: AiSopReviewFinding[];
  /** True when the document text was cut at the prompt cap. */
  truncated: boolean;
  reviewed_at: string;
}

/** Stored result of one AI triage pass over a validation run's findings. */
export interface AiTriageResult {
  id: string;
  validation_run_id: string;
  status: AiTriageStatus;
  model: string;
  /** Run-level narrative: what happened in this run, in plain English. */
  summary: string;
  clusters: AiTriageCluster[];
  findings_analyzed: number;
  findings_total: number;
  input_tokens: number;
  output_tokens: number;
  error_message: string | null;
  created_by: string;
  created_at: string;
}
