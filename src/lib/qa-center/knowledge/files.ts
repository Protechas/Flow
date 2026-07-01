import { parseMcChartManufacturer } from "@/lib/qa-center/knowledge/manifest";
import {
  getKnowledgeVersionById,
  listKnowledgeEntries,
} from "@/lib/qa-center/knowledge/db";
import { downloadKnowledgeVersionBuffer } from "@/lib/qa-center/knowledge/storage";
import { getKnowledgeLibraryRoot, resolveKnowledgeRelativePath } from "@/lib/qa-center/knowledge/paths";
import fs from "node:fs/promises";
import path from "node:path";

export interface ActiveKnowledgeFileRef {
  entryKey: string | null;
  category: string;
  title: string;
  versionId: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  manufacturers?: string[];
}

export async function knowledgeFileExists(relativePath: string): Promise<boolean> {
  try {
    const abs = resolveKnowledgeRelativePath(relativePath);
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

export async function getKnowledgeFileBuffer(relativePath: string): Promise<Buffer> {
  const abs = resolveKnowledgeRelativePath(relativePath);
  return fs.readFile(abs);
}

export async function listMcChartFiles(): Promise<
  { fileName: string; relativePath: string; manufacturer: string; fileSize: number }[]
> {
  const entries = await listKnowledgeEntries();
  const mcc = entries.find(
    (e) =>
      e.category === "manufacturer_component_chart" &&
      e.active_version?.storage_path &&
      !e.is_archived
  );

  if (mcc?.index_metadata?.manufacturers?.length) {
    return mcc.index_metadata.manufacturers.map((manufacturer) => ({
      fileName: `${manufacturer} Component Manufacturer Chart`,
      relativePath: mcc.active_version!.storage_path!,
      manufacturer,
      fileSize: mcc.active_version?.file_size ?? 0,
    }));
  }

  const chartsDir = path.join(getKnowledgeLibraryRoot(), "mc-charts");
  try {
    const names = await fs.readdir(chartsDir);
    const results: {
      fileName: string;
      relativePath: string;
      manufacturer: string;
      fileSize: number;
    }[] = [];

    for (const fileName of names) {
      if (!fileName.toLowerCase().endsWith(".xlsx")) continue;
      const manufacturer = parseMcChartManufacturer(fileName);
      if (!manufacturer) continue;
      const relativePath = path.join("mc-charts", fileName).replace(/\\/g, "/");
      const stat = await fs.stat(resolveKnowledgeRelativePath(relativePath));
      results.push({ fileName, relativePath, manufacturer, fileSize: stat.size });
    }

    return results.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));
  } catch {
    return [];
  }
}

export async function listMcChartManufacturers(): Promise<string[]> {
  const charts = await listMcChartFiles();
  return charts.map((c) => c.manufacturer);
}

export async function listActiveKnowledgeFilesForEngine(): Promise<ActiveKnowledgeFileRef[]> {
  const entries = await listKnowledgeEntries();
  const refs: ActiveKnowledgeFileRef[] = [];

  for (const entry of entries) {
    const version = entry.active_version;
    if (!version?.storage_path) continue;

    refs.push({
      entryKey: entry.entry_key,
      category: entry.category,
      title: entry.title,
      versionId: version.id,
      fileName: version.file_name ?? entry.title,
      storagePath: version.storage_path,
      mimeType: version.mime_type,
      manufacturers:
        entry.category === "manufacturer_component_chart"
          ? entry.index_metadata?.manufacturers ??
            version.index_metadata?.manufacturers
          : undefined,
    });
  }

  return refs;
}

export async function getMcChartPathForManufacturer(
  manufacturer: string
): Promise<{ relativePath: string; fileName: string } | null> {
  const normalized = manufacturer.trim().toLowerCase();
  const charts = await listMcChartFiles();
  const match = charts.find((c) => c.manufacturer.toLowerCase() === normalized);
  if (!match) return null;
  return { relativePath: match.relativePath, fileName: match.fileName };
}

export async function getKnowledgeVersionBuffer(versionId: string): Promise<Buffer> {
  const version = await getKnowledgeVersionById(versionId);
  if (!version) throw new Error("Knowledge version not found");
  return downloadKnowledgeVersionBuffer(version);
}
