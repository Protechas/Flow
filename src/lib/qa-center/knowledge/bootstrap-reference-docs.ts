import { QA_REFERENCE_DOCUMENTS } from "@/lib/qa-center/knowledge/manifest";
import { registerLocalReferenceVersion } from "@/lib/qa-center/knowledge/db";
import { knowledgeFileExists } from "@/lib/qa-center/knowledge/files";

let bootstrapPromise: Promise<number> | null = null;

/** Import bundled local reference files when an entry has no active version yet. */
export async function ensureReferenceDocumentsLoaded(): Promise<number> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      let attached = 0;
      for (const doc of QA_REFERENCE_DOCUMENTS) {
        const exists = await knowledgeFileExists(doc.relativePath);
        if (!exists) continue;
        const ok = await registerLocalReferenceVersion({
          entry_key: doc.entryKey,
          relativePath: doc.relativePath,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          changeNotes: doc.changeNotes ?? `Reference version ${doc.versionLabel}`,
        });
        if (ok) attached += 1;
      }
      return attached;
    })();
  }
  return bootstrapPromise;
}
