"use server";

import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { isAiEnabled, AI_DISABLED_MESSAGE } from "@/lib/ai/client";
import { runFindingsTriage } from "@/lib/ai/triage";
import { getTriageForRun } from "@/lib/ai/triage-db";
import type { AiTriageResult } from "@/lib/ai/types";
import { getValidationRun } from "@/lib/validation-center/runs";
import { listFindingsForRun } from "@/lib/validation-center/findings";

export interface AiTriageActionResult {
  ok: boolean;
  triage: AiTriageResult | null;
  message?: string;
}

export async function getAiTriageAction(runId: string): Promise<AiTriageResult | null> {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) return null;
  return getTriageForRun(runId);
}

/** Explicit user action only — this is the one place findings triage spends API budget. */
export async function runAiTriageAction(runId: string): Promise<AiTriageActionResult> {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:run")) {
    return { ok: false, triage: null, message: "You do not have permission to run AI triage" };
  }
  if (!isAiEnabled()) {
    return { ok: false, triage: null, message: AI_DISABLED_MESSAGE };
  }

  const run = await getValidationRun(runId);
  if (!run) {
    return { ok: false, triage: null, message: "Run not found" };
  }
  if (run.status !== "completed") {
    return { ok: false, triage: null, message: "Triage runs on completed audits only" };
  }

  const findings = await listFindingsForRun(runId);
  if (findings.length === 0) {
    return { ok: false, triage: null, message: "This run has no findings to analyze" };
  }

  const triage = await runFindingsTriage(run, findings, user.id);
  if (triage.status === "failed") {
    return {
      ok: false,
      triage,
      message: "AI triage failed — see the error on the panel and try again",
    };
  }
  return { ok: true, triage };
}
