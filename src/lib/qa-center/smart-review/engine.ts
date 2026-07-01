import {
  extractDocumentText,
} from "@/lib/qa-center/content/extract-text";
import { listZipEntryNames } from "@/lib/qa-center/knowledge/indexer";
import type { KnowledgeReferenceContext, KnowledgeReferenceDoc } from "@/lib/qa-center/knowledge/resolver";
import {
  getKnowledgeDocumentBuffer,
  loadKnowledgeReferenceContext,
} from "@/lib/qa-center/knowledge/resolver";
import type {
  LayerValidationInput,
  LayerValidationResult,
} from "@/lib/qa-center/rules/engine";
import { guessManufacturerFromFileName } from "@/lib/qa-center/validations/storage";
import {
  manufacturerSimilarity,
  normalizeManufacturer,
} from "@/lib/validation-center/manufacturer-normalization";
import type { QaValidationIssue } from "@/lib/qa-center/types";
import { newPersistedId } from "@/lib/server/persisted-id";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "will", "your",
  "are", "not", "all", "can", "was", "been", "has", "may", "also", "into", "each",
]);

export interface SmartReviewMeta {
  method: "knowledge_heuristic";
  status: "completed";
  version: "1";
  summary: string;
  signals: SmartReviewSignal[];
  checks_run: number;
  checks_passed: number;
  reference_docs_used: number;
}

export interface SmartReviewSignal {
  id: string;
  label: string;
  passed: boolean;
  score: number;
  detail: string;
}

function smartIssue(
  partial: Omit<QaValidationIssue, "id" | "status" | "assigned_analyst_id" | "reviewer_notes"> & {
    ai_confidence: number;
    ai_explanation: string;
  }
): QaValidationIssue {
  return {
    ...partial,
    id: newPersistedId("qvi"),
    status: "open",
    assigned_analyst_id: null,
    reviewer_notes: null,
    category: partial.category || "smart_review",
  };
}

function significantTokens(text: string, limit = 400): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return new Set(tokens.slice(0, limit));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const t of a) {
    if (b.has(t)) overlap += 1;
  }
  return overlap / (a.size + b.size - overlap);
}

function termCoverage(docText: string, terms: string[]): { score: number; missing: string[] } {
  const haystack = docText.toLowerCase();
  const unique = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 2))];
  if (unique.length === 0) return { score: 1, missing: [] };
  const missing = unique.filter((t) => !haystack.includes(t));
  return { score: (unique.length - missing.length) / unique.length, missing };
}

function collectIndexTerms(docs: KnowledgeReferenceDoc[]): string[] {
  const terms = new Set<string>();
  for (const doc of docs) {
    const meta = doc.indexMetadata as { search_terms?: string[]; manufacturers?: string[] } | null;
    for (const t of meta?.search_terms ?? []) terms.add(t);
    for (const m of meta?.manufacturers ?? []) terms.add(m);
    for (const token of doc.title.split(/[\s_\-/]+/)) {
      if (token.length > 2) terms.add(token);
    }
  }
  return [...terms].slice(0, 120);
}

function pickGoldStandard(
  goldDocs: KnowledgeReferenceDoc[],
  manufacturer: string | null | undefined
): KnowledgeReferenceDoc | null {
  if (goldDocs.length === 0) return null;
  if (!manufacturer) return goldDocs[0];
  let best = goldDocs[0];
  let bestScore = manufacturerSimilarity(manufacturer, goldDocs[0].title);
  for (const doc of goldDocs.slice(1)) {
    const score = Math.max(
      manufacturerSimilarity(manufacturer, doc.title),
      manufacturerSimilarity(manufacturer, doc.fileName)
    );
    if (score > bestScore) {
      best = doc;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : goldDocs[0];
}

async function loadReferenceText(doc: KnowledgeReferenceDoc): Promise<string | null> {
  try {
    const buffer = await getKnowledgeDocumentBuffer(doc);
    return extractDocumentText(buffer, doc.fileName, doc.mimeType);
  } catch {
    return null;
  }
}

function parseYearFromFileName(fileName: string): number | null {
  const match = fileName.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

/** Layer 5 — knowledge-backed smart review (no external AI APIs). */
export async function runSmartReview(
  input: LayerValidationInput & { file_buffer: Buffer },
  priorResults: LayerValidationResult[],
  ctx?: KnowledgeReferenceContext
): Promise<{ result: LayerValidationResult; meta: SmartReviewMeta }> {
  const context = ctx ?? (await loadKnowledgeReferenceContext());
  const issues: QaValidationIssue[] = [];
  const signals: SmartReviewSignal[] = [];
  let referenceDocsUsed = 0;

  const ext = input.file_name.split(".").pop()?.toLowerCase() ?? "";
  const docText = extractDocumentText(input.file_buffer, input.file_name, input.mime_type);
  const docTokens = significantTokens(docText);
  const wordCount = docText.split(/\s+/).filter(Boolean).length;

  // — Manufacturer coherence (filename vs declared vs body text)
  const declared = input.manufacturer?.trim() ?? "";
  const fromFile = guessManufacturerFromFileName(input.file_name);
  if (declared && fromFile) {
    const sim = manufacturerSimilarity(declared, fromFile);
    const passed = sim >= 0.75;
    signals.push({
      id: "manufacturer_coherence",
      label: "Manufacturer name coherence",
      passed,
      score: Math.round(sim * 100),
      detail: passed
        ? `Declared "${declared}" matches filename hint "${fromFile}"`
        : `Declared "${declared}" differs from filename hint "${fromFile}" (${Math.round(sim * 100)}% match)`,
    });
    if (!passed) {
      const confidence = Math.round((1 - sim) * 100);
      issues.push(
        smartIssue({
          severity: sim < 0.5 ? "high" : "medium",
          category: "smart_review",
          rule_key: "manufacturer_coherence",
          rule_violated: "Manufacturer coherence",
          evidence: `Declared: ${declared} · Filename: ${fromFile}`,
          why_failed: "Declared manufacturer does not align with the file name",
          suggested_fix: `Use consistent naming — e.g. ${normalizeManufacturer(declared).display}_YYYY_Component.pdf`,
          document_ref: input.file_name,
          ai_confidence: confidence,
          ai_explanation: `Filename token "${fromFile}" only ${Math.round(sim * 100)}% similar to declared "${declared}". Smart review cross-checks naming against metadata.`,
        })
      );
    }
  }

  // — Model year appears in document when present in filename
  const fileYear = parseYearFromFileName(input.file_name);
  if (fileYear) {
    const yearInBody = docText.includes(String(fileYear));
    signals.push({
      id: "year_in_body",
      label: "Model year in document",
      passed: yearInBody,
      score: yearInBody ? 100 : 40,
      detail: yearInBody
        ? `Year ${fileYear} found in document text`
        : `Filename includes ${fileYear} but year not found in extractable text`,
    });
    if (!yearInBody && wordCount > 80) {
      issues.push(
        smartIssue({
          severity: "low",
          category: "smart_review",
          rule_key: "year_in_body",
          rule_violated: "Model year consistency",
          evidence: String(fileYear),
          why_failed: `File name references ${fileYear} but that year was not found in document content`,
          suggested_fix: "Include model year in the document header or title block per SI Content SOP",
          document_ref: input.file_name,
          ai_confidence: 72,
          ai_explanation: "Smart review compares filename metadata tokens against extracted document text.",
        })
      );
    }
  }

  // — SOP vocabulary coverage from indexed knowledge terms
  const sopDocs = [
    ...(context.byCategory.si_content_sop ?? []),
    ...(context.byCategory.si_library_sop ?? []),
  ];
  if (sopDocs.length > 0 && wordCount > 30) {
    referenceDocsUsed += sopDocs.length;
    const sopTerms = collectIndexTerms(sopDocs);
    const { score, missing } = termCoverage(docText, sopTerms.slice(0, 40));
    const passed = score >= 0.25 || sopTerms.length < 5;
    signals.push({
      id: "sop_vocabulary",
      label: "SOP vocabulary coverage",
      passed,
      score: Math.round(score * 100),
      detail: passed
        ? `${Math.round(score * 100)}% of indexed SOP terms found in document`
        : `Only ${Math.round(score * 100)}% SOP vocabulary overlap — ${missing.slice(0, 3).join(", ")} missing`,
    });
    if (score < 0.15 && sopTerms.length >= 8) {
      issues.push(
        smartIssue({
          severity: "medium",
          category: "smart_review",
          rule_key: "sop_vocabulary",
          rule_violated: "SOP vocabulary alignment",
          evidence: missing.slice(0, 5).join(", "),
          why_failed: "Document text has low overlap with active SI SOP vocabulary from Knowledge Library",
          suggested_fix: "Review against the active SI Content SOP — terminology may be outdated or incomplete",
          document_ref: input.file_name,
          ai_confidence: Math.round((0.25 - score) * 200),
          ai_explanation: `Compared ${sopTerms.length} indexed SOP terms; ${Math.round(score * 100)}% appear in this submission.`,
        })
      );
    }
  }

  // — Safety acronym presence when library has safety references
  const safetyDocs = context.byCategory.safety_acronyms ?? [];
  if (safetyDocs.length > 0 && wordCount > 50) {
    referenceDocsUsed += safetyDocs.length;
    const acronyms = collectIndexTerms(safetyDocs)
      .filter((t) => /^[A-Z0-9]{2,6}$/.test(t.toUpperCase()) && t.length <= 6)
      .map((t) => t.toUpperCase())
      .slice(0, 25);
    if (acronyms.length > 0) {
      const { score, missing } = termCoverage(docText, acronyms);
      const passed = score >= 0.2;
      signals.push({
        id: "safety_acronyms",
        label: "Safety acronym coverage",
        passed,
        score: Math.round(score * 100),
        detail: `${Math.round(score * 100)}% of indexed safety acronyms referenced`,
      });
      if (score < 0.1 && acronyms.length >= 5) {
        issues.push(
          smartIssue({
            severity: "low",
            category: "smart_review",
            rule_key: "safety_acronyms",
            rule_violated: "Safety acronym references",
            evidence: missing.slice(0, 6).join(", "),
            why_failed: "Few safety system acronyms from the library appear in this document",
            suggested_fix: "Cross-check Safety System Acronyms reference in Knowledge Library",
            document_ref: input.file_name,
            ai_confidence: 65,
            ai_explanation: "Smart review scans for indexed safety acronyms — not a substitute for full SOP compliance.",
          })
        );
      }
    }
  }

  // — Gold standard structural similarity
  const goldDocs = context.byCategory.gold_standard ?? [];
  const goldPick = pickGoldStandard(goldDocs, input.manufacturer);
  if (goldPick && wordCount > 80) {
    const goldText = await loadReferenceText(goldPick);
    if (goldText) {
      referenceDocsUsed += 1;
      const goldTokens = significantTokens(goldText);
      const sim = jaccardSimilarity(docTokens, goldTokens);
      const passed = sim >= 0.12;
      signals.push({
        id: "gold_standard_similarity",
        label: "Gold standard similarity",
        passed,
        score: Math.round(sim * 100),
        detail: `${Math.round(sim * 100)}% token overlap with "${goldPick.title}"`,
      });
      if (sim < 0.08) {
        issues.push(
          smartIssue({
            severity: "medium",
            category: "smart_review",
            rule_key: "gold_standard_similarity",
            rule_violated: "Gold standard structure",
            evidence: goldPick.title,
            why_failed: "Document structure and vocabulary diverge significantly from the nearest gold standard",
            suggested_fix: "Compare section order and terminology against the approved gold standard in Knowledge Library",
            document_ref: input.file_name,
            ai_confidence: Math.round((0.12 - sim) * 500),
            ai_explanation: `Token overlap ${Math.round(sim * 100)}% vs gold standard "${goldPick.title}" — heuristic structural match, not pixel comparison.`,
          })
        );
      }
    }
  }

  // — ZIP package vs MCC index
  if (ext === "zip" && input.manufacturer) {
    const mccDocs = context.byCategory.manufacturer_component_chart ?? [];
    const innerNames = listZipEntryNames(input.file_buffer);
    if (mccDocs.length > 0 && innerNames.length > 0) {
      referenceDocsUsed += 1;
      const indexedNames = new Set<string>();
      for (const doc of mccDocs) {
        const meta = doc.indexMetadata as { file_names?: string[] } | null;
        for (const n of meta?.file_names ?? []) {
          indexedNames.add(n.split(/[/\\]/).pop()?.toLowerCase() ?? n.toLowerCase());
        }
      }
      const normalizedMfg = normalizeManufacturer(input.manufacturer).key;
      const relevantInner = innerNames.filter((n) => {
        const key = normalizeManufacturer(n.split(/[/\\]/).pop() ?? n).key;
        return manufacturerSimilarity(key, normalizedMfg) >= 0.5 || n.toLowerCase().includes(normalizedMfg);
      });
      const passed = relevantInner.length > 0;
      signals.push({
        id: "zip_mcc_alignment",
        label: "ZIP package vs MCC index",
        passed,
        score: passed ? 100 : 30,
        detail: passed
          ? `${relevantInner.length} inner file(s) align with ${input.manufacturer} MCC index`
          : `No inner files matched ${input.manufacturer} in MCC index (${innerNames.length} files in ZIP)`,
      });
      if (!passed) {
        issues.push(
          smartIssue({
            severity: "high",
            category: "smart_review",
            rule_key: "zip_mcc_alignment",
            rule_violated: "ZIP / MCC alignment",
            evidence: innerNames.slice(0, 5).join(", "),
            why_failed: `ZIP contents do not match indexed MC Chart files for ${input.manufacturer}`,
            suggested_fix: "Verify ZIP contains the correct manufacturer chart files before upload",
            document_ref: input.file_name,
            ai_confidence: 85,
            ai_explanation: "Smart review lists ZIP entries and compares against Knowledge Library MCC file index.",
          })
        );
      }
    }
  }

  // — Document richness (extractable content quality)
  if (wordCount < 120 && ext === "pdf") {
    signals.push({
      id: "text_richness",
      label: "Extractable text richness",
      passed: false,
      score: Math.min(100, wordCount),
      detail: `Only ~${wordCount} words extractable — may be scanned or image-only`,
    });
    if (!issues.some((i) => i.rule_key === "required_sections")) {
      issues.push(
        smartIssue({
          severity: "low",
          category: "smart_review",
          rule_key: "text_richness",
          rule_violated: "Extractable content",
          evidence: `~${wordCount} words`,
          why_failed: "Very little selectable text — smart checks have low confidence",
          suggested_fix: "Submit source DOCX or a text-based PDF for reliable validation",
          document_ref: input.file_name,
          ai_confidence: 80,
          ai_explanation: "Heuristic text extraction found minimal content; section and vocabulary checks may be incomplete.",
        })
      );
    }
  } else {
    signals.push({
      id: "text_richness",
      label: "Extractable text richness",
      passed: true,
      score: Math.min(100, Math.round((wordCount / 800) * 100)),
      detail: `~${wordCount} words available for analysis`,
    });
  }

  // — Cross-check: prior deterministic failures get smart explanations
  const priorIssueCount = priorResults.reduce((n, r) => n + r.issues.length, 0);
  if (priorIssueCount > 0) {
    signals.push({
      id: "deterministic_summary",
      label: "Deterministic rule summary",
      passed: false,
      score: Math.max(0, 100 - priorIssueCount * 15),
      detail: `${priorIssueCount} issue(s) from file/content/MCC/business layers`,
    });
  }

  const checksRun = signals.length;
  const checksPassed = signals.filter((s) => s.passed).length;
  const signalScore =
    checksRun > 0
      ? Math.round(signals.reduce((sum, s) => sum + s.score, 0) / checksRun)
      : 100;

  const penalty = issues.reduce((sum, i) => {
    switch (i.severity) {
      case "critical":
        return sum + 30;
      case "high":
        return sum + 20;
      case "medium":
        return sum + 12;
      case "low":
        return sum + 6;
      default:
        return sum + 2;
    }
  }, 0);

  const score = Math.max(0, Math.min(100, signalScore - penalty));
  const passed = !issues.some((i) => i.severity === "high" || i.severity === "critical");

  const summary =
    checksRun === 0
      ? "Smart review skipped — upload a document with extractable text and load Knowledge Library references."
      : checksPassed === checksRun
        ? `All ${checksRun} smart checks passed — document aligns with library references.`
        : `${checksPassed}/${checksRun} smart checks passed — review flagged items before human QA.`;

  const meta: SmartReviewMeta = {
    method: "knowledge_heuristic",
    status: "completed",
    version: "1",
    summary,
    signals,
    checks_run: checksRun,
    checks_passed: checksPassed,
    reference_docs_used: referenceDocsUsed,
  };

  return {
    result: {
      layer: "ai",
      passed,
      score,
      issues,
    },
    meta,
  };
}
