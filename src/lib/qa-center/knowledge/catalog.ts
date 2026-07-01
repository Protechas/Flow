import type { QaKnowledgeCategory } from "@/lib/qa-center/types";

/** Canonical taxonomy — every validation reference type admins can upload. */
export const QA_KNOWLEDGE_TAXONOMY: {
  entryKey: string;
  category: QaKnowledgeCategory;
  title: string;
  description: string;
}[] = [
  {
    entryKey: "manufacturer_component_charts",
    category: "manufacturer_component_chart",
    title: "Manufacturer Component Charts",
    description: "OEM component charts (ZIP bundle or individual XLSX) for deliverable verification",
  },
  {
    entryKey: "si_library_sop",
    category: "si_library_sop",
    title: "SI Library SOP",
    description: "Standard operating procedure for SI library builds",
  },
  {
    entryKey: "si_library_component_sop",
    category: "si_library_sop",
    title: "SI Library Component SOP",
    description: "Component library build and mapping standards",
  },
  {
    entryKey: "si_content_sop",
    category: "si_content_sop",
    title: "SI Content SOP",
    description: "Content standards for Service Information documents",
  },
  {
    entryKey: "adobe_formatting_sop",
    category: "adobe_formatting_sop",
    title: "Adobe Formatting SOP",
    description: "Highlight colors, layout, and Adobe formatting requirements",
  },
  {
    entryKey: "safety_acronyms",
    category: "safety_acronyms",
    title: "Safety System Acronyms",
    description: "Approved acronym reference for safety systems",
  },
  {
    entryKey: "id3_mapping_workbook",
    category: "id3_mapping",
    title: "ID³ Mapping Workbook",
    description: "ID³ mapping rules and workbook reference",
  },
  {
    entryKey: "pcs_workbook",
    category: "pcs_workbook",
    title: "PCS Workbook",
    description: "PCS validation reference workbook",
  },
  {
    entryKey: "ro_response_templates",
    category: "ro_response_templates",
    title: "RO Response Templates",
    description: "Repair order response templates and examples",
  },
  {
    entryKey: "id3_pcs_ro_workbook",
    category: "id3_mapping",
    title: "ID³ Map, PCS, & RO Response Templates",
    description: "Combined ID³ mapping, PCS rules, and RO response templates",
  },
  {
    entryKey: "training",
    category: "training",
    title: "Internal Training Documents",
    description: "Analyst training and onboarding material",
  },
  {
    entryKey: "gold_standard",
    category: "gold_standard",
    title: "Gold Standard Documents",
    description: "Approved perfect submissions used for comparison",
  },
];

/** @deprecated use QA_KNOWLEDGE_TAXONOMY */
export const QA_KNOWLEDGE_SEED = QA_KNOWLEDGE_TAXONOMY.filter(
  (e) =>
    ![
      "manufacturer_component_charts",
      "si_library_sop",
      "si_content_sop",
      "si_library_component_sop",
      "safety_acronyms",
      "id3_pcs_ro_workbook",
    ].includes(e.entryKey)
);

export const QA_KNOWLEDGE_CATEGORY_OPTIONS: { value: QaKnowledgeCategory; label: string }[] = [
  { value: "manufacturer_component_chart", label: "Manufacturer Component Chart" },
  { value: "si_library_sop", label: "SI Library SOP" },
  { value: "si_content_sop", label: "SI Content SOP" },
  { value: "adobe_formatting_sop", label: "Adobe Formatting SOP" },
  { value: "safety_acronyms", label: "Safety System Acronyms" },
  { value: "id3_mapping", label: "ID³ Mapping Workbook" },
  { value: "pcs_workbook", label: "PCS Workbook" },
  { value: "ro_response_templates", label: "RO Response Templates" },
  { value: "training", label: "Internal Training" },
  { value: "gold_standard", label: "Gold Standard Document" },
  { value: "other", label: "Other Reference" },
];

export const QA_KNOWLEDGE_ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".zip",
  ".txt",
] as const;
