import {
  manufacturerSimilarity,
  normalizeKey,
  normalizeManufacturer,
} from "@/lib/validation-center/manufacturer-normalization";

const MC_HINTS = [
  "component manufacturer chart",
  "manufacturer chart",
  "manufacturer component",
  " mc ",
];

const EXPORT_HINTS = ["onedrive", "export", "file list"];

export type FileKind = "manufacturer_chart" | "onedrive_export" | "unknown" | "invalid";

export type BatchRowStatus =
  | "ready"
  | "waiting_for_chart"
  | "waiting_for_export"
  | "duplicate"
  | "needs_review"
  | "unknown"
  | "possible_match";

export interface BatchImportFileRef {
  fileKey: string;
  file: File;
  kind: FileKind;
  rawManufacturer: string;
  manufacturer: string;
  manufacturerKey: string;
  issues: string[];
  isDuplicate: boolean;
  duplicateGroupId: string | null;
}

export interface BatchImportRow {
  id: string;
  manufacturer: string;
  manufacturerKey: string;
  mcFile: File | null;
  exportFile: File | null;
  mcFileKey: string | null;
  exportFileKey: string | null;
  status: BatchRowStatus;
  statusLabel: string;
  issues: string[];
  confidence: number | null;
  confidenceLabel: string;
  forceRun: boolean;
}

export interface PossibleMatchSuggestion {
  id: string;
  mcFile: File;
  exportFile: File;
  mcFileKey: string;
  exportFileKey: string;
  mcManufacturer: string;
  exportManufacturer: string;
  manufacturer: string;
  confidence: number;
  resolution: "pending" | "paired" | "ignored";
}

export interface DuplicateFileGroup {
  id: string;
  kind: FileKind;
  manufacturer: string;
  manufacturerKey: string;
  files: BatchImportFileRef[];
  selectedFileKey: string;
}

export interface BatchValidationSummary {
  manufacturersDetected: number;
  ready: number;
  waiting: number;
  duplicates: number;
  needsReview: number;
  invalidFiles: number;
  possibleMatches: number;
  confidenceAverage: number | null;
  missingExport: number;
  missingChart: number;
  filesReceived: number;
}

export interface BatchImportState {
  duplicateSelections: Record<string, string>;
  possibleMatchActions: Record<string, "paired" | "ignored">;
  forceRunRowIds: string[];
}

export interface BatchValidationResult {
  rows: BatchImportRow[];
  possibleMatches: PossibleMatchSuggestion[];
  duplicateGroups: DuplicateFileGroup[];
  invalidFiles: BatchImportFileRef[];
  summary: BatchValidationSummary;
}

export function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function isExcelUpload(file: File): boolean {
  return /\.xlsx?$/i.test(file.name);
}

function stem(filename: string): string {
  return filename.replace(/\.xlsx?$/i, "").trim();
}

export function classifyFileKind(filename: string): FileKind {
  if (!isExcelUpload({ name: filename } as File)) return "invalid";
  const lower = filename.toLowerCase();
  if (MC_HINTS.some((h) => lower.includes(h))) return "manufacturer_chart";
  if (EXPORT_HINTS.some((h) => lower.includes(h))) return "onedrive_export";
  if (/\d+\.xlsx$/i.test(lower) && !lower.includes("chart")) return "onedrive_export";
  if (lower.includes("chart")) return "manufacturer_chart";
  return "unknown";
}

export function extractRawManufacturer(filename: string): string {
  const s = stem(filename);
  const lower = s.toLowerCase();

  for (const hint of MC_HINTS) {
    const idx = lower.indexOf(hint);
    if (idx >= 0) {
      const name = s.slice(0, idx).trim().replace(/^[\s\-_]+|[\s\-_]+$/g, "");
      if (name) return name;
    }
  }

  const yearMatch = s.match(/^([A-Za-z][A-Za-z0-9 &.'-]+?)\s+\d+$/);
  if (yearMatch) return yearMatch[1].trim();

  const odMatch = lower.match(/^([a-z0-9 &.'-]+?)\s+onedrive/);
  if (odMatch) return s.slice(0, odMatch[1].length).trim();

  const parts = s.split(/[\s_-]+/);
  return parts[0]?.trim() || "Unknown";
}

function confidenceLabel(score: number): string {
  if (score >= 100) return "Exact match";
  if (score >= 98) return "Normalized manufacturer";
  if (score >= 85) return "Strong match";
  if (score >= 60) return "Possible match";
  return "Requires review";
}

function computePairConfidence(
  mc: BatchImportFileRef,
  exp: BatchImportFileRef
): number {
  if (mc.manufacturerKey === exp.manufacturerKey && mc.manufacturerKey !== "unknown") {
    if (mc.kind === "manufacturer_chart" && exp.kind === "onedrive_export") {
      if (normalizeKey(mc.rawManufacturer) === normalizeKey(exp.rawManufacturer)) return 100;
      return 98;
    }
    return 85;
  }

  const sim = manufacturerSimilarity(mc.manufacturer, exp.manufacturer);
  if (sim >= 0.92) return 85;
  if (sim >= 0.75) return Math.round(60 + sim * 25);
  return Math.round(sim * 59);
}

function statusLabel(status: BatchRowStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "waiting_for_chart":
      return "Waiting for Chart";
    case "waiting_for_export":
      return "Waiting for Export";
    case "duplicate":
      return "Duplicate";
    case "needs_review":
      return "Needs Review";
    case "possible_match":
      return "Possible Match";
    default:
      return "Unknown";
  }
}

function discoverFiles(files: File[]): {
  valid: BatchImportFileRef[];
  invalid: BatchImportFileRef[];
} {
  const valid: BatchImportFileRef[] = [];
  const invalid: BatchImportFileRef[] = [];
  const seenKeys = new Set<string>();

  for (const file of files) {
    const key = fileKey(file);
    const kind = classifyFileKind(file.name);
    const raw = extractRawManufacturer(file.name);
    const normalized = normalizeManufacturer(raw);

    if (kind === "invalid") {
      invalid.push({
        fileKey: key,
        file,
        kind,
        rawManufacturer: raw,
        manufacturer: normalized.display,
        manufacturerKey: normalized.key,
        issues: ["Invalid file type — Excel (.xlsx / .xls) required"],
        isDuplicate: false,
        duplicateGroupId: null,
      });
      continue;
    }

    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    valid.push({
      fileKey: key,
      file,
      kind,
      rawManufacturer: raw,
      manufacturer: normalized.display,
      manufacturerKey: normalized.key,
      issues: kind === "unknown" ? ["Filename needs review — could not classify file role"] : [],
      isDuplicate: false,
      duplicateGroupId: null,
    });
  }

  return { valid, invalid };
}

function buildDuplicateGroups(
  refs: BatchImportFileRef[],
  selections: Record<string, string>
): { groups: DuplicateFileGroup[]; active: BatchImportFileRef[] } {
  const byGroup = new Map<string, BatchImportFileRef[]>();

  for (const ref of refs) {
    if (ref.kind !== "manufacturer_chart" && ref.kind !== "onedrive_export") continue;
    const groupId = `${ref.manufacturerKey}::${ref.kind}`;
    const list = byGroup.get(groupId) ?? [];
    list.push(ref);
    byGroup.set(groupId, list);
  }

  const groups: DuplicateFileGroup[] = [];
  const active: BatchImportFileRef[] = [];
  const skipped = new Set<string>();

  for (const [groupId, list] of byGroup.entries()) {
    if (list.length <= 1) {
      active.push(list[0]!);
      continue;
    }

    const sorted = [...list].sort((a, b) => b.file.lastModified - a.file.lastModified);
    const selectedKey = selections[groupId] ?? fileKey(sorted[0]!.file);
    const selected =
      sorted.find((r) => r.fileKey === selectedKey) ?? sorted[0]!;

    for (const ref of sorted) {
      ref.duplicateGroupId = groupId;
      ref.isDuplicate = ref.fileKey !== selected.fileKey;
      if (ref.isDuplicate) {
        ref.issues = [...ref.issues, "Duplicate file — newer version available"];
        skipped.add(ref.fileKey);
      }
    }

    groups.push({
      id: groupId,
      kind: selected.kind as "manufacturer_chart" | "onedrive_export",
      manufacturer: selected.manufacturer,
      manufacturerKey: selected.manufacturerKey,
      files: sorted,
      selectedFileKey: selected.fileKey,
    });

    active.push({ ...selected, isDuplicate: false });
  }

  // Include unknown kind files
  for (const ref of refs) {
    if (ref.kind === "unknown" && !skipped.has(ref.fileKey)) {
      active.push(ref);
    }
  }

  return { groups, active };
}

export function validateBatchImport(
  files: File[],
  state: BatchImportState = {
    duplicateSelections: {},
    possibleMatchActions: {},
    forceRunRowIds: [],
  }
): BatchValidationResult {
  const { valid, invalid } = discoverFiles(files);
  const { groups: duplicateGroups, active } = buildDuplicateGroups(
    valid,
    state.duplicateSelections
  );

  const usedKeys = new Set<string>();
  const rows: BatchImportRow[] = [];
  const possibleMatches: PossibleMatchSuggestion[] = [];

  const byManufacturer = new Map<string, { mc: BatchImportFileRef[]; exp: BatchImportFileRef[] }>();
  const unpairedMc: BatchImportFileRef[] = [];
  const unpairedExp: BatchImportFileRef[] = [];

  for (const ref of active) {
    if (ref.isDuplicate) continue;
    if (ref.kind === "manufacturer_chart") {
      const bucket = byManufacturer.get(ref.manufacturerKey) ?? { mc: [], exp: [] };
      bucket.mc.push(ref);
      byManufacturer.set(ref.manufacturerKey, bucket);
    } else if (ref.kind === "onedrive_export") {
      const bucket = byManufacturer.get(ref.manufacturerKey) ?? { mc: [], exp: [] };
      bucket.exp.push(ref);
      byManufacturer.set(ref.manufacturerKey, bucket);
    }
  }

  // High-confidence auto pairs per manufacturer key
  for (const [mfrKey, bucket] of byManufacturer.entries()) {
    const display = bucket.mc[0]?.manufacturer ?? bucket.exp[0]?.manufacturer ?? "Unknown";
    const mc = bucket.mc[0] ?? null;
    const exp = bucket.exp[0] ?? null;

    if (mc && exp) {
      const confidence = computePairConfidence(mc, exp);
      const autoPair = confidence >= 85;
      usedKeys.add(mc.fileKey);
      usedKeys.add(exp.fileKey);

      rows.push({
        id: `row-${mfrKey}`,
        manufacturer: display,
        manufacturerKey: mfrKey,
        mcFile: mc.file,
        exportFile: exp.file,
        mcFileKey: mc.fileKey,
        exportFileKey: exp.fileKey,
        status: autoPair ? "ready" : "needs_review",
        statusLabel: statusLabel(autoPair ? "ready" : "needs_review"),
        issues: autoPair ? [] : ["Confidence below auto-pair threshold — review before running"],
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        forceRun: state.forceRunRowIds.includes(`row-${mfrKey}`),
      });

      // Extra files same mfr -> duplicate rows
      for (let i = 1; i < bucket.mc.length; i++) {
        const extra = bucket.mc[i]!;
        usedKeys.add(extra.fileKey);
        rows.push(makeDuplicateRow(extra, "chart"));
      }
      for (let i = 1; i < bucket.exp.length; i++) {
        const extra = bucket.exp[i]!;
        usedKeys.add(extra.fileKey);
        rows.push(makeDuplicateRow(extra, "export"));
      }
      continue;
    }

    if (mc && !exp) {
      usedKeys.add(mc.fileKey);
      unpairedMc.push(mc);
      rows.push({
        id: `row-${mfrKey}`,
        manufacturer: display,
        manufacturerKey: mfrKey,
        mcFile: mc.file,
        exportFile: null,
        mcFileKey: mc.fileKey,
        exportFileKey: null,
        status: "waiting_for_export",
        statusLabel: statusLabel("waiting_for_export"),
        issues: ["Missing OneDrive export"],
        confidence: null,
        confidenceLabel: "—",
        forceRun: false,
      });
      for (let i = 1; i < bucket.mc.length; i++) {
        usedKeys.add(bucket.mc[i]!.fileKey);
        rows.push(makeDuplicateRow(bucket.mc[i]!, "chart"));
      }
      continue;
    }

    if (exp && !mc) {
      usedKeys.add(exp.fileKey);
      unpairedExp.push(exp);
      rows.push({
        id: `row-${mfrKey}`,
        manufacturer: display,
        manufacturerKey: mfrKey,
        mcFile: null,
        exportFile: exp.file,
        mcFileKey: null,
        exportFileKey: exp.fileKey,
        status: "waiting_for_chart",
        statusLabel: statusLabel("waiting_for_chart"),
        issues: ["Missing manufacturer chart"],
        confidence: null,
        confidenceLabel: "—",
        forceRun: false,
      });
      for (let i = 1; i < bucket.exp.length; i++) {
        usedKeys.add(bucket.exp[i]!.fileKey);
        rows.push(makeDuplicateRow(bucket.exp[i]!, "export"));
      }
    }
  }

  // Cross-manufacturer possible matches
  for (const mc of unpairedMc) {
    if (usedKeys.has(mc.fileKey)) continue;
    for (const exp of unpairedExp) {
      if (usedKeys.has(exp.fileKey)) continue;
      const confidence = computePairConfidence(mc, exp);
      if (confidence < 60 || confidence >= 85) continue;

      const matchId = `pm-${mc.fileKey}-${exp.fileKey}`;
      const resolution = state.possibleMatchActions[matchId] ?? "pending";
      const normalized = normalizeManufacturer(
        manufacturerSimilarity(mc.manufacturer, exp.manufacturer) >= 0.75
          ? mc.manufacturer
          : `${mc.manufacturer} / ${exp.manufacturer}`
      );

      possibleMatches.push({
        id: matchId,
        mcFile: mc.file,
        exportFile: exp.file,
        mcFileKey: mc.fileKey,
        exportFileKey: exp.fileKey,
        mcManufacturer: mc.manufacturer,
        exportManufacturer: exp.manufacturer,
        manufacturer: normalized.display,
        confidence,
        resolution,
      });

      if (resolution === "paired") {
        usedKeys.add(mc.fileKey);
        usedKeys.add(exp.fileKey);
        rows.push({
          id: `row-pm-${matchId}`,
          manufacturer: normalized.display,
          manufacturerKey: normalized.key,
          mcFile: mc.file,
          exportFile: exp.file,
          mcFileKey: mc.fileKey,
          exportFileKey: exp.fileKey,
          status: "ready",
          statusLabel: statusLabel("ready"),
          issues: [],
          confidence,
          confidenceLabel: confidenceLabel(confidence),
          forceRun: state.forceRunRowIds.includes(`row-pm-${matchId}`),
        });
      }
    }
  }

  // Unknown / unclassified files
  for (const ref of active) {
    if (usedKeys.has(ref.fileKey) || ref.isDuplicate) continue;
    if (ref.kind === "unknown") {
      rows.push({
        id: `row-unknown-${ref.fileKey}`,
        manufacturer: ref.manufacturer,
        manufacturerKey: ref.manufacturerKey,
        mcFile: null,
        exportFile: null,
        mcFileKey: null,
        exportFileKey: null,
        status: "unknown",
        statusLabel: statusLabel("unknown"),
        issues: [`Unclassified file: ${ref.file.name}`, ...ref.issues],
        confidence: null,
        confidenceLabel: "—",
        forceRun: false,
      });
      usedKeys.add(ref.fileKey);
    }
  }

  rows.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));

  const summary = buildSummary(rows, possibleMatches, invalid, duplicateGroups, files.length);

  return { rows, possibleMatches, duplicateGroups, invalidFiles: invalid, summary };
}

function makeDuplicateRow(ref: BatchImportFileRef, side: "chart" | "export"): BatchImportRow {
  return {
    id: `row-dup-${ref.fileKey}`,
    manufacturer: ref.manufacturer,
    manufacturerKey: ref.manufacturerKey,
    mcFile: side === "chart" ? ref.file : null,
    exportFile: side === "export" ? ref.file : null,
    mcFileKey: side === "chart" ? ref.fileKey : null,
    exportFileKey: side === "export" ? ref.fileKey : null,
    status: "duplicate",
    statusLabel: statusLabel("duplicate"),
    issues: ["Duplicate file for this manufacturer"],
    confidence: null,
    confidenceLabel: "—",
    forceRun: false,
  };
}

function buildSummary(
  rows: BatchImportRow[],
  possibleMatches: PossibleMatchSuggestion[],
  invalid: BatchImportFileRef[],
  duplicateGroups: DuplicateFileGroup[],
  filesReceived: number
): BatchValidationSummary {
  const primaryRows = rows.filter((r) => !r.id.startsWith("row-dup-"));
  const mfrKeys = new Set(
    primaryRows.filter((r) => r.status !== "unknown" && r.status !== "duplicate").map((r) => r.manufacturerKey)
  );

  const ready = primaryRows.filter((r) => r.status === "ready").length;
  const waiting = primaryRows.filter(
    (r) => r.status === "waiting_for_chart" || r.status === "waiting_for_export"
  ).length;
  const needsReview = primaryRows.filter((r) => r.status === "needs_review" || r.status === "unknown").length;
  const duplicates = rows.filter((r) => r.status === "duplicate").length + duplicateGroups.length;
  const pendingPossible = possibleMatches.filter((p) => p.resolution === "pending").length;

  const confidences = primaryRows
    .map((r) => r.confidence)
    .filter((c): c is number => c != null);
  const confidenceAverage =
    confidences.length > 0
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10
      : null;

  return {
    manufacturersDetected: mfrKeys.size,
    ready,
    waiting,
    duplicates,
    needsReview,
    invalidFiles: invalid.length,
    possibleMatches: pendingPossible,
    confidenceAverage,
    missingExport: primaryRows.filter((r) => r.status === "waiting_for_export").length,
    missingChart: primaryRows.filter((r) => r.status === "waiting_for_chart").length,
    filesReceived,
  };
}

export function getRunnableRows(
  result: BatchValidationResult,
  includeReview = false
): BatchImportRow[] {
  return result.rows.filter((row) => {
    if (row.status === "ready") return true;
    if (includeReview && (row.status === "needs_review" || row.forceRun)) return true;
    if (row.forceRun && row.mcFile && row.exportFile) return true;
    return false;
  });
}

export const EMPTY_BATCH_STATE: BatchImportState = {
  duplicateSelections: {},
  possibleMatchActions: {},
  forceRunRowIds: [],
};
