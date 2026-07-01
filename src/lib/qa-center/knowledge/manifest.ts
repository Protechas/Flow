import type { QaKnowledgeCategory } from "@/lib/qa-center/types";

export interface QaReferenceDocumentManifest {
  entryKey: string;
  category: QaKnowledgeCategory;
  title: string;
  description: string;
  /** Path relative to data/knowledge-library */
  relativePath: string;
  fileName: string;
  mimeType: string;
  versionLabel: string;
  changeNotes?: string;
  extraTags?: string[];
}

/** Protech reference documents — paths resolved at runtime, never hard-coded in validation rules. */
export const QA_REFERENCE_DOCUMENTS: QaReferenceDocumentManifest[] = [
  {
    entryKey: "si_library_sop",
    category: "si_library_sop",
    title: "SI Library SOP",
    description: "Standard operating procedure for SI library builds (July 2022)",
    relativePath: "sops/(1) Service Information Library SOP 07-2022.docx",
    fileName: "(1) Service Information Library SOP 07-2022.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    versionLabel: "07-2022",
    changeNotes: "Initial Protech reference import",
  },
  {
    entryKey: "si_content_sop",
    category: "si_content_sop",
    title: "SI Content SOP",
    description: "Content standards for Service Information documents (July 2022)",
    relativePath: "sops/(2) SI Content SOP 07-2022.docx",
    fileName: "(2) SI Content SOP 07-2022.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    versionLabel: "07-2022",
    changeNotes: "Initial Protech reference import",
  },
  {
    entryKey: "si_library_component_sop",
    category: "si_library_sop",
    title: "SI Library Component SOP",
    description: "Component library build standards (June 2026)",
    relativePath: "sops/SI Library Component SOP 06-2026.docx",
    fileName: "SI Library Component SOP 06-2026.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    versionLabel: "06-2026",
    changeNotes: "Initial Protech reference import",
    extraTags: ["component", "library"],
  },
  {
    entryKey: "safety_acronyms",
    category: "safety_acronyms",
    title: "Safety System Acronyms",
    description: "SME safety system acronym definitions (January 2025)",
    relativePath: "sops/(2d) SME Safety System Acronym Definitions 1-30-25.docx",
    fileName: "(2d) SME Safety System Acronym Definitions 1-30-25.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    versionLabel: "01-2025",
    changeNotes: "Initial Protech reference import",
  },
  {
    entryKey: "id3_pcs_ro_workbook",
    category: "id3_mapping",
    title: "ID³ Map, PCS, & RO Response Templates",
    description: "Combined ID³ mapping, PCS rules, and RO response templates (v2.0)",
    relativePath: "sops/Combined ID3 Map, PCS, & RO Response Templates v2.0.xlsx",
    fileName: "Combined ID3 Map, PCS, & RO Response Templates v2.0.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    versionLabel: "v2.0",
    changeNotes: "Initial Protech reference import",
    extraTags: ["id3_mapping", "pcs_workbook", "ro_response_templates"],
  },
  {
    entryKey: "manufacturer_component_charts",
    category: "manufacturer_component_chart",
    title: "Manufacturer Component Charts",
    description: "OEM component charts archive for deliverable verification (30 manufacturers)",
    relativePath: "mc-charts.zip",
    fileName: "MC Charts.zip",
    mimeType: "application/zip",
    versionLabel: "v6.9.x bundle",
    changeNotes: "Initial Protech reference import — extracted charts indexed separately",
    extraTags: ["mcc", "manufacturer"],
  },
];

/** Parse OEM name from chart filename, e.g. "Toyota Component Manufacturer Chart v6.9.1.2.xlsx" */
export function parseMcChartManufacturer(fileName: string): string | null {
  const match = fileName.match(/^(.+?)\s+Component Manufacturer Chart/i);
  return match?.[1]?.trim() ?? null;
}
