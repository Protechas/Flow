import type { ContentCheckRules } from "@/lib/content-checks/rules";

/**
 * Content-check engine — pure and isomorphic. The Tools batch auditor runs it
 * in the browser (drag-drop, zero server cost); the QA pipeline runs it on
 * the server against task uploads. Flags direct human attention; nothing here
 * auto-fails a person or a submission.
 */

export interface ExtractedHighlight {
  page: number;
  colorGroup: "yellow" | "blue" | "other";
}

export interface ExtractedDoc {
  fileName: string;
  fileSizeBytes: number;
  numPages: number;
  landscapePages: number;
  /** Text of the first pages (enough for identity + section signals). */
  text: string;
  hasTextLayer: boolean;
  highlights: ExtractedHighlight[];
}

export interface ParsedDocumentName {
  year: number;
  makeModel: string;
  evNomenclature: string | null;
  component: string;
  partNumber: number | null;
}

export type FlagSeverity = "fail" | "warn" | "info";

export interface CheckFlag {
  code: string;
  severity: FlagSeverity;
  message: string;
}

export interface ContentCheckResult {
  verdict: "pass" | "flagged" | "unreadable";
  flags: CheckFlag[];
  parsedName: ParsedDocumentName | null;
  /** SOP placeholder: "this system doesn't apply to this model". */
  isPlaceholder: boolean;
}

/** Component SOP naming grammar:
 * "2020 Chevrolet Silverado 1500 (FRS)" / "2025 Toyota Prius [HEV] (FRS)"
 * with optional "-Part-N" split suffix. */
const NAME_RE =
  /^(\d{4})\s+(.+?)\s*(?:\[([A-Za-z]+)\])?\s*\(([^)]+)\)\s*(?:[-\s]*place\s*holder)?\s*(?:[-\s]*part[-\s]*(\d{1,3}))?\s*\.pdf$/i;

export function parseDocumentName(fileName: string): ParsedDocumentName | null {
  const m = fileName.trim().match(NAME_RE);
  if (!m) return null;
  return {
    year: Number(m[1]),
    makeModel: m[2].trim(),
    evNomenclature: m[3] ? m[3].toUpperCase() : null,
    component: m[4].trim().toUpperCase(),
    partNumber: m[5] ? Number(m[5]) : null,
  };
}

/** Placeholder docs mark "this system doesn't apply to this model" — required
 * by SOP, judged gently, and they DO fill their component slot. */
export function isPlaceholderDoc(fileName: string, text: string): boolean {
  return /place\s*holder/i.test(fileName) || /place\s*holder/i.test(text.slice(0, 800));
}

function knownAcronym(component: string, rules: ContentCheckRules): boolean {
  const all = [
    ...rules.components,
    ...rules.legacyFeatures,
    ...rules.specialFunctions,
  ].map((a) => a.toUpperCase());
  if (all.includes(component)) return true;
  // "ACC 2" → base "ACC"; "EBDE [1]" style handled by base token too.
  const base = component.split(/[\s[]/)[0];
  return all.includes(base);
}

/** Tokens from the make/model that should appear in the document content.
 * Short/common tokens are skipped — "4Runner" is a signal, "the" is not. */
function identityTokens(parsed: ParsedDocumentName): string[] {
  return parsed.makeModel
    .split(/\s+/)
    .map((t) => t.replace(/[^\w+-]/g, ""))
    .filter((t) => t.length >= 3);
}

/** Model phrase without the make — "Lexus RC F" → "rc f". OEM body text often
 * names the model but never the brand. */
function modelPhrase(parsed: ParsedDocumentName): string {
  const words = parsed.makeModel.split(/\s+/);
  return words.slice(1).join(" ").toLowerCase().trim();
}

export function runContentChecks(
  doc: ExtractedDoc,
  rules: ContentCheckRules
): ContentCheckResult {
  const flags: CheckFlag[] = [];
  const currentYear = new Date().getFullYear();
  const text = doc.text.toLowerCase();
  const isPlaceholder = isPlaceholderDoc(doc.fileName, doc.text);

  // ---- Structural ----
  if (doc.numPages === 0) {
    return {
      verdict: "unreadable",
      flags: [{ code: "corrupt", severity: "fail", message: "File could not be read as a PDF." }],
      parsedName: parseDocumentName(doc.fileName),
      isPlaceholder,
    };
  }
  if (!doc.hasTextLayer) {
    flags.push({
      code: "no_text_layer",
      severity: "warn",
      message:
        "No readable text layer — likely a scan or image-only PDF. Content checks can't verify it.",
    });
  }
  const sizeKb = doc.fileSizeBytes / 1024;
  const parsed = parseDocumentName(doc.fileName);
  if (sizeKb > rules.maxFileKb) {
    flags.push({
      code: "oversize",
      severity: "fail",
      message: `File is ${Math.round(sizeKb)}KB — SOP requires under ${rules.maxFileKb}KB (compress, or re-split with "-Part-N").`,
    });
  }
  if (rules.requireLandscape && doc.numPages > 0 && doc.landscapePages < doc.numPages) {
    const portrait = doc.numPages - doc.landscapePages;
    flags.push({
      code: "orientation",
      severity: portrait === doc.numPages ? "fail" : "warn",
      message:
        portrait === doc.numPages
          ? "Document is portrait — SOP requires landscape orientation."
          : `${portrait} of ${doc.numPages} pages are portrait — SOP requires landscape.`,
    });
  }

  // ---- Naming grammar ----
  if (!parsed) {
    flags.push({
      code: "naming_grammar",
      severity: "fail",
      message:
        'File name doesn\'t match the SOP pattern "Year Make Model [EV] (COMPONENT)" — e.g. "2025 Toyota Prius [HEV] (FRS)".',
    });
  } else {
    if (parsed.year < rules.minYear || parsed.year > currentYear + 2) {
      flags.push({
        code: "year_range",
        severity: "warn",
        message: `Model year ${parsed.year} is outside the library range (${rules.minYear}–${currentYear + 1}).`,
      });
    }
    if (!knownAcronym(parsed.component, rules)) {
      flags.push({
        code: "unknown_component",
        severity: "warn",
        message: `"(${parsed.component})" isn't a known component, feature, or special-function acronym.`,
      });
    }
    if (parsed.evNomenclature && !rules.evNomenclature.includes(parsed.evNomenclature)) {
      flags.push({
        code: "ev_nomenclature",
        severity: "warn",
        message: `"[${parsed.evNomenclature}]" isn't a recognized EV nomenclature (${rules.evNomenclature.join(", ")}).`,
      });
    }
    const firstWord = parsed.makeModel.split(/\s+/)[0]?.toLowerCase() ?? "";
    const spelledOut = rules.makeShorthands[firstWord];
    if (spelledOut) {
      flags.push({
        code: "make_shorthand",
        severity: "fail",
        message: `Make must be spelled out — "${parsed.makeModel.split(/\s+/)[0]}" should be "${spelledOut}".`,
      });
    }
  }

  // ---- Identity: does the inside match the outside? ----
  // Split continuations (-Part-2..N) carry procedure body only — the header
  // that names the vehicle lives in Part-1, so identity applies at the
  // logical-document level (see runContentChecksOnSet), never to lone parts.
  const isContinuationPart = (parsed?.partNumber ?? 1) > 1;
  if (parsed && doc.hasTextLayer && !isPlaceholder && !isContinuationPart) {
    const tokens = identityTokens(parsed);
    const phrase = modelPhrase(parsed);
    const tokenHit = tokens.some((t) => text.includes(t.toLowerCase()));
    const phraseHit = phrase.length >= 2 && text.includes(phrase);
    if (tokens.length + (phrase ? 1 : 0) > 0 && !tokenHit && !phraseHit) {
      // Short model codes ("RC F") give the matcher little to grab — flag
      // softer when the name itself is weak evidence.
      const strongName = tokens.length >= 2;
      flags.push({
        code: "identity_mismatch",
        severity: strongName ? "fail" : "warn",
        message: `Content never mentions "${parsed.makeModel}" — this may be the wrong document under the right name.`,
      });
    }
    const yearInText =
      text.includes(String(parsed.year)) ||
      // OEM docs state ranges like "Model Year Start: 2022" — a nearby earlier
      // year is normal; only a totally absent year signals a mismatch.
      /model year/i.test(doc.text);
    if (!yearInText) {
      flags.push({
        code: "year_not_in_content",
        severity: "warn",
        message: `Content never mentions ${parsed.year} (or a model-year line) — verify the year is right.`,
      });
    }
  }

  // ---- Highlights (Component SOP: yellow = pre-quals, light blue = conditions) ----
  // Also a logical-document rule: the yellow pre-qual highlight lives in one
  // part of a split doc. Lone continuation parts skip it.
  if (!isPlaceholder && doc.numPages > 0 && !isContinuationPart) {
    const yellow = doc.highlights.filter((h) => h.colorGroup === "yellow").length;
    const blue = doc.highlights.filter((h) => h.colorGroup === "blue").length;
    const mentionsPrequal = rules.prequalKeywords.some((k) => text.includes(k.toLowerCase()));

    if (yellow === 0) {
      flags.push({
        code: "no_yellow_highlight",
        severity: mentionsPrequal ? "fail" : "warn",
        message: mentionsPrequal
          ? "Content mentions pre-qualifications but nothing is highlighted yellow — SOP requires pre-quals highlighted (or the first line when none apply)."
          : "No yellow highlight found — SOP requires pre-quals highlighted, or the first line highlighted when none apply.",
      });
    }
    if (blue === 0 && doc.hasTextLayer) {
      flags.push({
        code: "no_blue_highlight",
        severity: "warn",
        message:
          "No light-blue highlight found — SOP requires Conditions of Calibration (when to calibrate) highlighted blue.",
      });
    }
  }

  const verdict: ContentCheckResult["verdict"] = flags.some((f) => f.severity === "fail")
    ? "flagged"
    : flags.some((f) => f.severity === "warn")
      ? "flagged"
      : "pass";

  return { verdict, flags, parsedName: parsed, isPlaceholder };
}

// ---- Logical documents: "-Part-1..N" files are ONE document ----

/** "2025 Lexus RC F (AEB 2)-Part-3.pdf" → "2025 Lexus RC F (AEB 2)" */
export function documentBaseName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-\s]*part[-\s]*\d{1,3}\s*$/i, "")
    .trim();
}

export interface LogicalDocResult {
  baseName: string;
  partFiles: string[];
  totalPages: number;
  totalSizeKb: number;
  result: ContentCheckResult;
}

/**
 * Check a batch the way the SOP means it: split parts merge into one logical
 * document for identity and highlight rules (the vehicle header and the
 * yellow pre-qual highlight live in one part), while per-file rules (size,
 * orientation, text layer) still run on every part.
 */
export function runContentChecksOnSet(
  docs: ExtractedDoc[],
  rules: ContentCheckRules
): LogicalDocResult[] {
  const groups = new Map<string, ExtractedDoc[]>();
  for (const doc of docs) {
    const key = documentBaseName(doc.fileName).toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }

  const results: LogicalDocResult[] = [];
  for (const parts of groups.values()) {
    const sorted = [...parts].sort(
      (a, b) =>
        (parseDocumentName(a.fileName)?.partNumber ?? 1) -
        (parseDocumentName(b.fileName)?.partNumber ?? 1)
    );
    const first = sorted[0];
    const baseName = documentBaseName(first.fileName);
    const firstPartNumber = parseDocumentName(first.fileName)?.partNumber ?? null;

    // A lone continuation part (Part-3 dropped in without Part-1) can't be
    // identity-checked — its header lives elsewhere. Say so instead of
    // guessing wrong in either direction.
    if (sorted.length === 1 && firstPartNumber != null && firstPartNumber > 1) {
      const solo = runContentChecks(first, rules);
      solo.flags.push({
        code: "solo_continuation",
        severity: "info",
        message: `Only Part ${firstPartNumber} is in this batch — include Part 1 to run identity and highlight checks on the full document.`,
      });
      results.push({
        baseName,
        partFiles: [first.fileName],
        totalPages: first.numPages,
        totalSizeKb: Math.round(first.fileSizeBytes / 1024),
        result: { ...solo, verdict: solo.flags.some((f) => f.severity !== "info") ? solo.verdict : "pass" },
      });
      continue;
    }

    // Merged view for document-level rules.
    const merged: ExtractedDoc = {
      // Part suffix stripped so identity/highlight checks run at doc level.
      fileName: `${baseName}.pdf`,
      fileSizeBytes: Math.max(...sorted.map((d) => d.fileSizeBytes)),
      numPages: sorted.reduce((s, d) => s + d.numPages, 0),
      landscapePages: sorted.reduce((s, d) => s + d.landscapePages, 0),
      text: sorted.map((d) => d.text).join("\n"),
      hasTextLayer: sorted.some((d) => d.hasTextLayer),
      highlights: sorted.flatMap((d) => d.highlights),
    };
    const docResult = runContentChecks(merged, rules);
    const PER_PART_CODES = ["oversize", "orientation", "no_text_layer", "corrupt"];
    // Multi-part: structural findings come from the per-part pass below, not
    // the merged view (which would double-report them under the base name).
    const flags =
      sorted.length > 1
        ? docResult.flags.filter((f) => !PER_PART_CODES.includes(f.code))
        : [...docResult.flags];

    // Per-part structural rules keep their own identity in the report.
    if (sorted.length > 1) {
      for (const part of sorted) {
        const partResult = runContentChecks(part, rules);
        for (const f of partResult.flags) {
          if (PER_PART_CODES.includes(f.code)) {
            flags.push({ ...f, message: `${part.fileName}: ${f.message}` });
          }
        }
      }
      // Gaps in the part sequence mean pieces are missing from the batch.
      const numbers = sorted
        .map((d) => parseDocumentName(d.fileName)?.partNumber)
        .filter((n): n is number => n != null)
        .sort((a, b) => a - b);
      const expected = numbers.length ? numbers[numbers.length - 1] : 0;
      if (numbers.length && numbers.length < expected) {
        const missing = [];
        for (let n = 1; n <= expected; n++) if (!numbers.includes(n)) missing.push(n);
        flags.push({
          code: "missing_parts",
          severity: "warn",
          message: `Split document has gaps — missing Part ${missing.join(", ")} of ${expected}.`,
        });
      }
    }

    const verdict: ContentCheckResult["verdict"] =
      docResult.verdict === "unreadable"
        ? "unreadable"
        : flags.some((f) => f.severity !== "info")
          ? "flagged"
          : "pass";

    results.push({
      baseName,
      partFiles: sorted.map((d) => d.fileName),
      totalPages: merged.numPages,
      totalSizeKb: Math.round(sorted.reduce((s, d) => s + d.fileSizeBytes, 0) / 1024),
      result: {
        verdict,
        flags,
        parsedName: docResult.parsedName,
        isPlaceholder: docResult.isPlaceholder,
      },
    });
  }

  return results;
}

// ---- Model coverage: the SOP's "every model needs its component set" ----

export interface ModelCoverage {
  /** "2022 Chevrolet Silverado 1500" */
  modelLabel: string;
  year: number;
  makeModel: string;
  docs: LogicalDocResult[];
  /** required component → the doc base names satisfying it (directly or via a
   * legacy feature doc per the 06-2026 conversion map). */
  componentsPresent: Record<string, string[]>;
  /** Slots covered ONLY by a placeholder — "we checked, this model can't have
   * it". Covered per SOP, but shown distinctly from real documentation. */
  componentsViaPlaceholder: Record<string, string[]>;
  missingComponents: string[];
  flaggedDocs: number;
  /** Docs whose component doesn't map to any required slot (extra coverage —
   * special functions etc. — never counted against the model). */
  extraDocs: string[];
}

function componentSlot(component: string, rules: ContentCheckRules): string | null {
  const c = component.toUpperCase();
  const direct = rules.featureToComponent[c];
  if (direct) return direct;
  if (rules.requiredComponentSet.includes(c)) return c;
  const base = c.split(/[\s[]/)[0];
  if (rules.featureToComponent[base]) return rules.featureToComponent[base];
  if (rules.requiredComponentSet.includes(base)) return base;
  return null;
}

/** Group checked documents by model and grade the component set against the
 * SOP requirement (FRS/WSC/PDS/BUC/SVC/RRS/NV, +LW for Honda). */
export function analyzeModelCoverage(
  results: LogicalDocResult[],
  rules: ContentCheckRules
): ModelCoverage[] {
  const byModel = new Map<string, LogicalDocResult[]>();
  for (const r of results) {
    const parsed = r.result.parsedName;
    if (!parsed) continue;
    const key = `${parsed.year} ${parsed.makeModel}`.toLowerCase();
    byModel.set(key, [...(byModel.get(key) ?? []), r]);
  }

  const out: ModelCoverage[] = [];
  for (const docs of byModel.values()) {
    const parsed = docs[0].result.parsedName!;
    const makeWord = parsed.makeModel.split(/\s+/)[0]?.toLowerCase() ?? "";
    const required = [
      ...rules.requiredComponentSet,
      ...(rules.requiredExtrasByMake[makeWord] ?? []),
    ];

    const present: Record<string, string[]> = {};
    const viaPlaceholder: Record<string, string[]> = {};
    const extras: string[] = [];
    for (const doc of docs) {
      const component = doc.result.parsedName?.component ?? "";
      const slot = componentSlot(component, rules);
      if (slot && required.includes(slot)) {
        const bucket = doc.result.isPlaceholder ? viaPlaceholder : present;
        bucket[slot] = [...(bucket[slot] ?? []), doc.baseName];
      } else {
        extras.push(doc.baseName);
      }
    }
    // A slot with a real doc doesn't also need its placeholder listed.
    for (const slot of Object.keys(viaPlaceholder)) {
      if (present[slot]) delete viaPlaceholder[slot];
    }

    out.push({
      modelLabel: `${parsed.year} ${parsed.makeModel}`,
      year: parsed.year,
      makeModel: parsed.makeModel,
      docs,
      componentsPresent: present,
      componentsViaPlaceholder: viaPlaceholder,
      missingComponents: required.filter((c) => !present[c] && !viaPlaceholder[c]),
      flaggedDocs: docs.filter((d) => d.result.verdict === "flagged").length,
      extraDocs: extras,
    });
  }

  return out.sort((a, b) => a.modelLabel.localeCompare(b.modelLabel));
}

/** Classify a PDF highlight-annotation color into the SOP's meaning groups. */
export function classifyHighlightColor(rgb: number[] | null | undefined): ExtractedHighlight["colorGroup"] {
  if (!rgb || rgb.length < 3) return "other";
  // pdf.js reports 0..255 for annotation colors; normalize either scale.
  const [r, g, b] = rgb.map((v) => (v > 1 ? v / 255 : v));
  if (r > 0.75 && g > 0.7 && b < 0.55) return "yellow";
  if (b > 0.7 && g > 0.5 && r < 0.65) return "blue";
  return "other";
}
