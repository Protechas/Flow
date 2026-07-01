import type {
  QaDocumentValidation,
  QaValidationIssue,
  QaValidationLayer,
  QaValidationRule,
} from "@/lib/qa-center/types";
import {
  extractDocumentText,
  findMissingSections,
  matchesNamingPattern,
  pdfAppearsPortrait,
} from "@/lib/qa-center/content/extract-text";
import { newPersistedId } from "@/lib/server/persisted-id";

/** Default rules — overridden by DB / admin UI when configured. */
const DEFAULT_RULES: Omit<QaValidationRule, "id" | "updated_by" | "updated_at">[] = [
  {
    rule_key: "max_file_size_mb",
    layer: "file",
    label: "Maximum file size",
    description: "Reject files above configured size",
    config: { max_mb: 50 },
    enabled: true,
    weight: 1,
  },
  {
    rule_key: "allowed_extensions",
    layer: "file",
    label: "Accepted file types",
    description: "PDF, DOCX, XLSX, ZIP",
    config: { extensions: ["pdf", "docx", "xlsx", "zip"] },
    enabled: true,
    weight: 1,
  },
  {
    rule_key: "landscape_orientation",
    layer: "file",
    label: "Landscape orientation",
    description: "PDF pages should be landscape",
    config: { required: true },
    enabled: true,
    weight: 0.8,
  },
  {
    rule_key: "required_sections",
    layer: "content",
    label: "Required SI sections",
    description: "Validated against active SI Content SOP in Knowledge Library",
    config: {
      sections: [],
      source: "knowledge_library",
      source_category: "si_content_sop",
    },
    enabled: true,
    weight: 1.2,
  },
  {
    rule_key: "mcc_verification",
    layer: "mcc",
    label: "Manufacturer Component Chart",
    description: "Verify against active MCC documents in Knowledge Library",
    config: { source: "knowledge_library", source_category: "manufacturer_component_chart" },
    enabled: true,
    weight: 1.5,
  },
  {
    rule_key: "naming_convention",
    layer: "business",
    label: "Naming convention",
    description: "File and deliverable naming standards",
    config: { pattern: null },
    enabled: true,
    weight: 1,
  },
  {
    rule_key: "gold_standard_compare",
    layer: "content",
    label: "Gold standard comparison",
    description: "Compare submission against approved gold standards",
    config: { enabled: true },
    enabled: true,
    weight: 1,
  },
  {
    rule_key: "scoring_weights",
    layer: "scoring",
    label: "QA score weights",
    description: "Layer weights for composite QA score",
    config: { file: 0.15, content: 0.35, mcc: 0.25, business: 0.15, ai: 0.1 },
    enabled: true,
    weight: 1,
  },
];

let rules: QaValidationRule[] = [];
let hydratePromise: Promise<void> | null = null;

function ts() {
  return new Date().toISOString();
}

function defaultRules(): QaValidationRule[] {
  return DEFAULT_RULES.map((r) => ({
    ...r,
    id: newPersistedId("qvr"),
    updated_by: null,
    updated_at: ts(),
  }));
}

function ensureRules() {
  if (rules.length === 0) rules = defaultRules();
}

/** Load rules from Supabase (or seed defaults). Call before validation or rule UI. */
export async function hydrateValidationRules(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const { loadRulesFromDb, seedRulesToDb } = await import("@/lib/qa-center/rules/db");
    const dbRules = await loadRulesFromDb();
    if (dbRules.length > 0) {
      rules = dbRules;
      return;
    }
    rules = defaultRules();
    await seedRulesToDb(
      rules.map(({ id, updated_by, updated_at, ...rest }) => rest)
    );
  })();
  return hydratePromise;
}

export function listValidationRules(): QaValidationRule[] {
  ensureRules();
  return [...rules].sort((a, b) => a.layer.localeCompare(b.layer) || a.label.localeCompare(b.label));
}

export async function listValidationRulesHydrated(): Promise<QaValidationRule[]> {
  await hydrateValidationRules();
  return listValidationRules();
}

export function listRulesByLayer(layer: QaValidationLayer): QaValidationRule[] {
  return listValidationRules().filter((r) => r.layer === layer && r.enabled);
}

export async function updateValidationRule(
  ruleKey: string,
  updates: Partial<Pick<QaValidationRule, "config" | "enabled" | "weight" | "label" | "description">>,
  updatedBy?: string | null
): Promise<QaValidationRule | null> {
  await hydrateValidationRules();
  const idx = rules.findIndex((r) => r.rule_key === ruleKey);
  if (idx < 0) return null;
  rules[idx] = {
    ...rules[idx],
    ...updates,
    updated_by: updatedBy ?? rules[idx].updated_by,
    updated_at: ts(),
  };
  const { persistRuleUpdate } = await import("@/lib/qa-center/rules/db");
  await persistRuleUpdate(rules[idx], updatedBy);
  return rules[idx];
}

export function getScoringWeights(): Record<string, number> {
  const scoring = listValidationRules().find((r) => r.rule_key === "scoring_weights");
  const cfg = (scoring?.config ?? {}) as Record<string, number>;
  return {
    file: cfg.file ?? 0.15,
    content: cfg.content ?? 0.35,
    mcc: cfg.mcc ?? 0.25,
    business: cfg.business ?? 0.15,
    ai: cfg.ai ?? 0.1,
  };
}

export interface LayerValidationInput {
  file_name: string;
  mime_type?: string | null;
  file_size?: number | null;
  manufacturer?: string | null;
  file_buffer?: Buffer | null;
  metadata?: Record<string, unknown>;
}

export interface LayerValidationResult {
  layer: QaValidationLayer | "ai";
  passed: boolean;
  score: number;
  issues: QaValidationIssue[];
}

function issue(
  partial: Omit<QaValidationIssue, "id" | "status" | "assigned_analyst_id" | "reviewer_notes">
): QaValidationIssue {
  return {
    ...partial,
    id: newPersistedId("qvi"),
    status: "open",
    assigned_analyst_id: null,
    reviewer_notes: null,
  };
}

/** Layer 1 — deterministic file validation */
export function runFileLayer(input: LayerValidationInput): LayerValidationResult {
  const issues: QaValidationIssue[] = [];
  const maxRule = listRulesByLayer("file").find((r) => r.rule_key === "max_file_size_mb");
  const extRule = listRulesByLayer("file").find((r) => r.rule_key === "allowed_extensions");
  const landscapeRule = listRulesByLayer("file").find((r) => r.rule_key === "landscape_orientation");
  const maxMb = Number((maxRule?.config as { max_mb?: number }).max_mb ?? 50);
  const extensions = ((extRule?.config as { extensions?: string[] }).extensions ?? [
    "pdf",
    "docx",
    "xlsx",
    "zip",
  ]).map((e) => e.toLowerCase());

  if (input.file_size != null && input.file_size > maxMb * 1024 * 1024) {
    issues.push(
      issue({
        severity: "critical",
        category: "file",
        rule_key: "max_file_size_mb",
        rule_violated: "Maximum file size",
        evidence: `${(input.file_size / (1024 * 1024)).toFixed(1)} MB`,
        why_failed: `File exceeds ${maxMb} MB limit`,
        suggested_fix: "Split or compress the document before upload",
        document_ref: input.file_name,
        ai_confidence: null,
        ai_explanation: null,
      })
    );
  }

  const ext = input.file_name.split(".").pop()?.toLowerCase() ?? "";
  if (ext && !extensions.includes(ext)) {
    issues.push(
      issue({
        severity: "high",
        category: "file",
        rule_key: "allowed_extensions",
        rule_violated: "Accepted file types",
        evidence: ext,
        why_failed: `Extension .${ext} is not in the accepted list`,
        suggested_fix: `Convert to one of: ${extensions.join(", ")}`,
        document_ref: input.file_name,
        ai_confidence: null,
        ai_explanation: null,
      })
    );
  }

  if (
    landscapeRule?.enabled &&
    (landscapeRule.config as { required?: boolean }).required !== false &&
    input.file_buffer &&
    ext === "pdf"
  ) {
    const portrait = pdfAppearsPortrait(input.file_buffer);
    if (portrait === true) {
      issues.push(
        issue({
          severity: "medium",
          category: "file",
          rule_key: "landscape_orientation",
          rule_violated: "Landscape orientation",
          evidence: input.file_name,
          why_failed: "PDF appears to use portrait page layout",
          suggested_fix: "Re-export the document in landscape orientation per SI Library SOP",
          document_ref: input.file_name,
          ai_confidence: null,
          ai_explanation: null,
        })
      );
    }
  }

  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 25);
  return { layer: "file", passed: issues.length === 0, score, issues };
}

function runBusinessLayer(input: LayerValidationInput): LayerValidationResult {
  const issues: QaValidationIssue[] = [];
  const namingRule = listRulesByLayer("business").find((r) => r.rule_key === "naming_convention");
  if (namingRule) {
    const pattern = (namingRule.config as { pattern?: string | null }).pattern ?? null;
    if (!matchesNamingPattern(input.file_name, pattern)) {
      issues.push(
        issue({
          severity: "medium",
          category: "business",
          rule_key: "naming_convention",
          rule_violated: "Naming convention",
          evidence: input.file_name,
          why_failed: "File name does not match expected naming pattern",
          suggested_fix: "Use manufacturer, year, and component in the file name (e.g. Toyota_2024_ADAS.pdf)",
          document_ref: input.file_name,
          ai_confidence: null,
          ai_explanation: null,
        })
      );
    }
  }

  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 20);
  return { layer: "business", passed: issues.length === 0, score, issues };
}

function runContentLayer(input: LayerValidationInput): LayerValidationResult {
  const issues: QaValidationIssue[] = [];
  const contentRule = listRulesByLayer("content").find((r) => r.rule_key === "required_sections");
  const goldRule = listRulesByLayer("content").find((r) => r.rule_key === "gold_standard_compare");

  if (contentRule && input.file_buffer) {
    const cfg = contentRule.config as { sections?: string[] };
    const text = extractDocumentText(input.file_buffer, input.file_name, input.mime_type);
    const missing = findMissingSections(text, cfg.sections ?? []);
    if (missing.length > 0 && text.length > 50) {
      issues.push(
        issue({
          severity: missing.length >= 3 ? "high" : "medium",
          category: "content",
          rule_key: "required_sections",
          rule_violated: "Required SI sections",
          evidence: missing.slice(0, 4).join(", "),
          why_failed: `Missing expected sections: ${missing.join(", ")}`,
          suggested_fix: "Add missing sections per SI Content SOP before submitting to QA",
          document_ref: input.file_name,
          ai_confidence: null,
          ai_explanation: null,
        })
      );
    } else if (text.length <= 50 && input.file_name.endsWith(".pdf")) {
      issues.push(
        issue({
          severity: "low",
          category: "content",
          rule_key: "required_sections",
          rule_violated: "Required SI sections",
          evidence: "Limited extractable text",
          why_failed: "Could not extract enough text to verify section structure (scanned PDF?)",
          suggested_fix: "Ensure PDF has selectable text or submit source DOCX for validation",
          document_ref: input.file_name,
          ai_confidence: null,
          ai_explanation: null,
        })
      );
    }
  }

  if (goldRule?.enabled && (goldRule.config as { enabled?: boolean }).enabled !== false) {
    // Gold standard compare runs when library has gold_standard entries — flagged in knowledge pass
  }

  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 15);
  return { layer: "content", passed: !issues.some((i) => i.severity === "high" || i.severity === "critical"), score, issues };
}

function runMccLayer(input: LayerValidationInput): LayerValidationResult {
  return { layer: "mcc", passed: true, score: 100, issues: [] };
}

/** Run all deterministic layers (1–4). Smart review (layer 5) runs separately in the processor. */
export function runDeterministicValidation(input: LayerValidationInput): LayerValidationResult[] {
  return [
    runFileLayer(input),
    runContentLayer(input),
    runMccLayer(input),
    runBusinessLayer(input),
  ];
}

/** Knowledge-library-backed validation — never uses hardcoded SOP/chart content. */
export async function runDeterministicValidationWithKnowledge(
  input: LayerValidationInput
): Promise<LayerValidationResult[]> {
  const { loadKnowledgeReferenceContext } = await import("@/lib/qa-center/knowledge/resolver");
  const ctx = await loadKnowledgeReferenceContext();
  const results = runDeterministicValidation(input);

  const mccRule = listRulesByLayer("mcc").find((r) => r.rule_key === "mcc_verification");
  if (mccRule && input.manufacturer) {
    const mccResult = results.find((r) => r.layer === "mcc");
    if (mccResult) {
      const refs = ctx.byCategory.manufacturer_component_chart ?? [];
      if (refs.length === 0) {
        mccResult.passed = false;
        mccResult.score = 0;
        mccResult.issues.push(
          issue({
            severity: "critical",
            category: "mcc",
            rule_key: "mcc_verification",
            rule_violated: "Manufacturer Component Chart",
            evidence: input.manufacturer,
            why_failed: "No active Manufacturer Component Chart in Knowledge Library",
            suggested_fix: "Upload MC Charts to QA Center → Knowledge Library",
            document_ref: input.file_name,
            ai_confidence: null,
            ai_explanation: null,
          })
        );
      } else if (
        ctx.manufacturers.length > 0 &&
        !ctx.manufacturers.some((m) => m.toLowerCase() === input.manufacturer!.trim().toLowerCase())
      ) {
        mccResult.passed = false;
        mccResult.score = 50;
        mccResult.issues.push(
          issue({
            severity: "high",
            category: "mcc",
            rule_key: "mcc_verification",
            rule_violated: "Manufacturer Component Chart",
            evidence: input.manufacturer,
            why_failed: `Manufacturer "${input.manufacturer}" not found in active MCC index (${ctx.manufacturers.length} OEMs loaded)`,
            suggested_fix: "Verify manufacturer spelling or upload updated MC Charts",
            document_ref: input.file_name,
            ai_confidence: null,
            ai_explanation: null,
          })
        );
      }
    }
  }

  const contentRule = listRulesByLayer("content").find((r) => r.rule_key === "required_sections");
  if (contentRule) {
    const contentResult = results.find((r) => r.layer === "content");
    const siRefs = [
      ...(ctx.byCategory.si_content_sop ?? []),
      ...(ctx.byCategory.si_library_sop ?? []),
    ];
    if (contentResult && siRefs.length === 0) {
      contentResult.passed = false;
      contentResult.score = 40;
      contentResult.issues.push(
        issue({
          severity: "high",
          category: "content",
          rule_key: "required_sections",
          rule_violated: "SI Content SOP",
          evidence: "Knowledge Library",
          why_failed: "No active SI Content or Library SOP in Knowledge Library",
          suggested_fix: "Upload SI Content SOP and SI Library SOP to Knowledge Library",
          document_ref: input.file_name,
          ai_confidence: null,
          ai_explanation: null,
        })
      );
    }
  }

  const goldRefs = ctx.byCategory.gold_standard ?? [];
  const goldRule = listRulesByLayer("content").find((r) => r.rule_key === "gold_standard_compare");
  if (goldRule?.enabled && goldRefs.length === 0 && (goldRule.config as { enabled?: boolean }).enabled !== false) {
    const contentResult = results.find((r) => r.layer === "content");
    if (contentResult) {
      contentResult.issues.push(
        issue({
          severity: "info",
          category: "content",
          rule_key: "gold_standard_compare",
          rule_violated: "Gold standard comparison",
          evidence: "No gold standards indexed",
          why_failed: "Gold standard comparison skipped — no approved references in library",
          suggested_fix: "Upload gold standard documents to Knowledge Library when available",
          document_ref: input.file_name,
          ai_confidence: null,
          ai_explanation: null,
        })
      );
    }
  }

  return results;
}

export function computeQaScore(results: LayerValidationResult[]): number {
  const weights = getScoringWeights();
  let total = 0;
  let weightSum = 0;
  for (const r of results) {
    const w = weights[r.layer] ?? 0.1;
    total += r.score * w;
    weightSum += w;
  }
  return weightSum > 0 ? Math.round(total / weightSum) : 0;
}

export function verdictFromScore(
  score: number,
  issues: QaValidationIssue[]
): QaDocumentValidation["verdict"] {
  if (issues.some((i) => i.severity === "critical")) return "critical";
  if (score >= 85 && !issues.some((i) => i.severity === "high")) return "pass";
  if (score >= 70) return "warning";
  return "fail";
}
