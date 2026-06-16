import type { CompanyDocumentCategory } from "@/types/flow";

export const COMPANY_DOCUMENT_CATEGORIES: {
  value: CompanyDocumentCategory;
  label: string;
}[] = [
  { value: "sop", label: "SOP" },
  { value: "policy", label: "Policy" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];
