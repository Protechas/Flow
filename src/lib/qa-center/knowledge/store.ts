export {
  archiveKnowledgeEntry,
  countActiveKnowledgeEntries,
  createKnowledgeEntry,
  getKnowledgeEntryById,
  getKnowledgeEntryByKey,
  getKnowledgeVersionById,
  listKnowledgeEntries,
  listKnowledgeVersions,
  registerLocalReferenceVersion,
  searchKnowledgeEntries,
  setActiveKnowledgeVersion,
  uploadKnowledgeVersion,
} from "@/lib/qa-center/knowledge/db";

export { ensureReferenceDocumentsLoaded } from "@/lib/qa-center/knowledge/bootstrap-reference-docs";

export type { DbKnowledgeVersion } from "@/lib/qa-center/knowledge/db";
