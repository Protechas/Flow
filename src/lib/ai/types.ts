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
