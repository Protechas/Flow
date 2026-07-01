import { parseMcChartManufacturer } from "@/lib/qa-center/knowledge/manifest";
import type { QaKnowledgeCategory, QaKnowledgeIndexMetadata } from "@/lib/qa-center/types";

const ZIP_LOCAL_HEADER = 0x04034b50;

/** List entry names inside a ZIP without full extraction. */
export function listZipEntryNames(buffer: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== ZIP_LOCAL_HEADER) {
      offset += 1;
      continue;
    }
    const compMethod = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buffer.length) break;
    const name = buffer.toString("utf8", nameStart, nameEnd);
    if (name && !name.endsWith("/")) names.push(name);
    if (compMethod === 0) {
      offset = nameEnd + extraLen + compSize;
    } else {
      offset = nameEnd + extraLen + compSize;
    }
  }
  return names;
}

function tokenizeFileName(fileName: string): string[] {
  return fileName
    .replace(/\.[^.]+$/, "")
    .split(/[\s_\-/]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2);
}

export function indexKnowledgeDocument(input: {
  buffer: Buffer;
  fileName: string;
  category: QaKnowledgeCategory;
}): QaKnowledgeIndexMetadata {
  const searchTerms = new Set<string>(tokenizeFileName(input.fileName));
  const fileNames: string[] = [input.fileName];
  const manufacturers = new Set<string>();

  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "zip" || input.category === "manufacturer_component_chart") {
    const zipNames = ext === "zip" ? listZipEntryNames(input.buffer) : [];
    for (const inner of zipNames) {
      fileNames.push(inner);
      for (const term of tokenizeFileName(inner)) searchTerms.add(term);
      const mfg = parseMcChartManufacturer(inner);
      if (mfg) manufacturers.add(mfg);
    }
  }

  if (ext === "xlsx" && input.category === "manufacturer_component_chart") {
    const mfg = parseMcChartManufacturer(input.fileName);
    if (mfg) manufacturers.add(mfg);
  }

  return {
    manufacturers: [...manufacturers].sort((a, b) => a.localeCompare(b)),
    search_terms: [...searchTerms].slice(0, 200),
    file_names: fileNames.slice(0, 500),
    indexed_at: new Date().toISOString(),
  };
}

export function mergeEntryIndexMetadata(
  existing: QaKnowledgeIndexMetadata | null | undefined,
  versionMeta: QaKnowledgeIndexMetadata
): QaKnowledgeIndexMetadata {
  const manufacturers = new Set([
    ...(existing?.manufacturers ?? []),
    ...(versionMeta.manufacturers ?? []),
  ]);
  const searchTerms = new Set([
    ...(existing?.search_terms ?? []),
    ...(versionMeta.search_terms ?? []),
  ]);
  return {
    manufacturers: [...manufacturers].sort((a, b) => a.localeCompare(b)),
    search_terms: [...searchTerms].slice(0, 300),
    file_names: versionMeta.file_names ?? existing?.file_names,
    indexed_at: versionMeta.indexed_at,
  };
}
