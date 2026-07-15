/** Effective document counting — the anti-inflation layer.
 *
 * A document split into "-Part-1..N" files is one document. The same file
 * uploaded four times is one document. Counts that feed scores, forecasts,
 * badges, and progress all go through here so splitting or re-uploading
 * cannot manufacture output.
 */

export interface FileLike {
  file_name: string;
  file_size: number;
  /** SHA-256 of the bytes — renaming a file cannot change it. */
  content_hash?: string | null;
}

/** Explicit split/copy markers only — plain trailing digits (e.g. "Silverado
 * 2500") are legitimate names and are never collapsed. */
const SPLIT_SUFFIX =
  /(?:[\s_\-.]+(?:part|pt)[\s_\-.]*\d{1,3}|[\s_\-.]+\d{1,3}\s*of\s*\d{1,3}|\s*\(\d{1,2}\))$/i;

/** Canonical document identity for a file name (extension + split suffix
 * stripped). Bracket decorations ("Ram-Door[].pdf", "Ram-Door[2].pdf") are
 * noise, not identity — strip them so a renamed copy is still the same doc. */
export function documentKey(fileName: string): string {
  const stem = fileName.replace(/\.[a-z0-9]{1,5}$/i, "");
  return stem
    .replace(/\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(SPLIT_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Identity for exact-duplicate detection: content hash when we have one
 * (renames can't beat it), name + byte size for legacy rows without. */
function fileIdentity(f: FileLike): string {
  return f.content_hash ? `sha:${f.content_hash}` : `${f.file_name.toLowerCase()}|${f.file_size}`;
}

/** Collapse a raw upload list to effective documents:
 * 1. exact duplicates (same bytes, or same name + size) count once;
 * 2. explicit split parts of the same document count once. */
export function effectiveDocuments<T extends FileLike>(files: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const f of files) {
    const k = fileIdentity(f);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(f);
  }
  const byDoc = new Map<string, T>();
  for (const f of unique) {
    const k = documentKey(f.file_name);
    if (!byDoc.has(k)) byDoc.set(k, f);
  }
  return [...byDoc.values()];
}

export function effectiveDocumentCount(files: FileLike[]): number {
  return effectiveDocuments(files).length;
}

export interface InflationAnalysis {
  raw: number;
  /** after exact-duplicate removal */
  unique: number;
  /** after split-part collapsing — the honest document count */
  effective: number;
  duplicateCopies: number;
  splitParts: number;
}

export function analyzeInflation(files: FileLike[]): InflationAnalysis {
  const raw = files.length;
  const seen = new Set<string>();
  const unique: FileLike[] = [];
  for (const f of files) {
    const k = fileIdentity(f);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(f);
  }
  const effective = effectiveDocuments(unique).length;
  return {
    raw,
    unique: unique.length,
    effective,
    duplicateCopies: raw - unique.length,
    splitParts: unique.length - effective,
  };
}
