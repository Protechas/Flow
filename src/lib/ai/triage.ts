import { getAiClient, AI_MODELS } from "@/lib/ai/client";
import { pickFields, capText } from "@/lib/ai/allowlist";
import { logAiUsage } from "@/lib/ai/usage";
import { saveTriage } from "@/lib/ai/triage-db";
import type { AiTriageCluster, AiTriageResult } from "@/lib/ai/types";
import {
  VALIDATION_ROOT_CAUSE_LABELS,
  type ValidationFinding,
  type ValidationRootCause,
  type ValidationRun,
} from "@/lib/validation-center/types";

/**
 * ALLOWLIST (AI security rule #2): the ONLY finding fields ever sent to the
 * Claude API. Adding a field here is a reviewed decision — see docs/AI_SECURITY.md.
 */
const TRIAGE_FINDING_FIELDS = [
  "title",
  "severity",
  "root_cause",
  "match_status",
  "manufacturer",
  "suggested_correction",
] as const;

/** Evidence is engine output about library files — useful, but capped hard. */
const EVIDENCE_CHAR_CAP = 240;

/** Keeps the prompt and the response comfortably inside one request. */
const MAX_FINDINGS = 250;

const ROOT_CAUSES = Object.keys(VALIDATION_ROOT_CAUSE_LABELS) as ValidationRootCause[];
const PRIORITIES = ["now", "next", "later"] as const;

function findingPayload(finding: ValidationFinding, index: number) {
  return {
    // Findings are referenced by index in the prompt (not by UUID) to keep
    // both directions of the exchange compact.
    n: index,
    ...pickFields(finding, TRIAGE_FINDING_FIELDS),
    suggested_correction: capText(finding.suggested_correction ?? "", EVIDENCE_CHAR_CAP),
    evidence: capText(JSON.stringify(finding.evidence ?? {}), EVIDENCE_CHAR_CAP),
  };
}

const SYSTEM_PROMPT =
  "You are Eddy, Flow's built-in assistant, running findings triage. Flow is an " +
  "operations platform for a Service Information analyst team. A validation engine has audited a manufacturer's " +
  "document library and produced findings. Your job: group related findings into clusters " +
  "an analyst can work through efficiently, explain each cluster in plain English, and " +
  "recommend what to do. Be concrete and practical; analysts act on your groupings but " +
  "always review them — you advise, you never decide. " +
  "Respond with ONLY a JSON object, no markdown fences, matching exactly:\n" +
  "{\n" +
  '  "summary": "2-4 sentence plain-English narrative of what happened in this run",\n' +
  '  "clusters": [\n' +
  "    {\n" +
  '      "label": "short cluster name",\n' +
  '      "explanation": "what these findings mean, in plain English",\n' +
  `      "likely_root_cause": one of ${JSON.stringify(ROOT_CAUSES)},\n` +
  '      "recommended_action": "the concrete next step for the analyst",\n' +
  '      "priority": "now" | "next" | "later",\n' +
  '      "finding_indexes": [numbers from the n field]\n' +
  "    }\n" +
  "  ]\n" +
  "}\n" +
  "Rules: at most 8 clusters; every finding index appears in exactly one cluster; " +
  "order clusters by priority (now first).";

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function toCluster(
  raw: Record<string, unknown>,
  indexToId: Map<number, string>
): AiTriageCluster | null {
  const indexes = Array.isArray(raw.finding_indexes) ? raw.finding_indexes : [];
  const finding_ids = indexes
    .map((n) => indexToId.get(Number(n)))
    .filter((id): id is string => Boolean(id));
  if (finding_ids.length === 0) return null;

  const rootCause = String(raw.likely_root_cause ?? "");
  const priority = String(raw.priority ?? "");
  return {
    label: capText(String(raw.label ?? "Findings"), 120),
    explanation: String(raw.explanation ?? ""),
    likely_root_cause: (ROOT_CAUSES as string[]).includes(rootCause)
      ? (rootCause as ValidationRootCause)
      : "needs_investigation",
    recommended_action: String(raw.recommended_action ?? ""),
    priority: (PRIORITIES as readonly string[]).includes(priority)
      ? (priority as AiTriageCluster["priority"])
      : "next",
    finding_ids,
  };
}

/**
 * Runs one advisory triage pass over a completed run's findings and persists
 * the result. Called from a user action only — never from page load or jobs.
 */
export async function runFindingsTriage(
  run: ValidationRun,
  findings: ValidationFinding[],
  userId: string
): Promise<AiTriageResult> {
  const client = await getAiClient();
  if (!client) throw new Error("AI is not configured");

  const analyzed = findings.slice(0, MAX_FINDINGS);
  const indexToId = new Map(analyzed.map((f, i) => [i + 1, f.id]));
  const payload = analyzed.map((f, i) => findingPayload(f, i + 1));

  const runContext = {
    engine: run.engine_id,
    manufacturer: run.manufacturer,
    compliance_rate: run.compliance_rate,
    findings_sent: analyzed.length,
    findings_total: findings.length,
  };

  const base = {
    id: crypto.randomUUID(),
    validation_run_id: run.id,
    model: AI_MODELS.standard,
    findings_analyzed: analyzed.length,
    findings_total: findings.length,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  try {
    const response = await client.messages.create({
      model: AI_MODELS.standard,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Run context:\n${JSON.stringify(runContext)}\n\n` +
            `Findings:\n${JSON.stringify(payload)}`,
        },
      ],
    });

    await logAiUsage({
      feature: "findings_triage",
      model: AI_MODELS.standard,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      userId,
      runRef: run.id,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = extractJson(textBlock && "text" in textBlock ? textBlock.text : "");
    const clusters = (Array.isArray(parsed.clusters) ? parsed.clusters : [])
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => toCluster(c, indexToId))
      .filter((c): c is AiTriageCluster => c !== null)
      .slice(0, 8);

    return saveTriage({
      ...base,
      status: "completed",
      summary: String(parsed.summary ?? ""),
      clusters,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      error_message: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Triage failed";
    console.error("[ai-triage] run failed", message);
    return saveTriage({
      ...base,
      status: "failed",
      summary: "",
      clusters: [],
      input_tokens: 0,
      output_tokens: 0,
      error_message: capText(message, 500),
    });
  }
}
