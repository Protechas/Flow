import { QA_REFERENCE_DOCUMENTS } from "@/lib/qa-center/knowledge/manifest";
import { listKnowledgeEntries } from "@/lib/qa-center/knowledge/db";
import { knowledgeFileExists } from "@/lib/qa-center/knowledge/files";

export interface KnowledgeLibraryStatus {
  taxonomyTotal: number;
  loadedWithFile: number;
  referenceManifestTotal: number;
  referenceFilesOnDisk: number;
  referenceAttached: number;
  manufacturersIndexed: number;
  readyForValidation: boolean;
  missingCritical: string[];
}

export async function getKnowledgeLibraryStatus(): Promise<KnowledgeLibraryStatus> {
  const entries = await listKnowledgeEntries();
  const loadedWithFile = entries.filter((e) => e.active_version?.storage_path).length;

  let referenceFilesOnDisk = 0;
  for (const doc of QA_REFERENCE_DOCUMENTS) {
    if (await knowledgeFileExists(doc.relativePath)) referenceFilesOnDisk += 1;
  }

  const criticalKeys = ["si_content_sop", "si_library_sop", "manufacturer_component_charts"];
  const missingCritical = criticalKeys.filter(
    (key) => !entries.some((e) => e.entry_key === key && e.active_version?.storage_path)
  );

  const mcEntry = entries.find((e) => e.entry_key === "manufacturer_component_charts");
  const manufacturersIndexed = mcEntry?.index_metadata?.manufacturers?.length ?? 0;

  return {
    taxonomyTotal: entries.length,
    loadedWithFile,
    referenceManifestTotal: QA_REFERENCE_DOCUMENTS.length,
    referenceFilesOnDisk,
    referenceAttached: loadedWithFile,
    manufacturersIndexed,
    readyForValidation: missingCritical.length === 0,
    missingCritical,
  };
}
