import type { ValidationEngineDefinition } from "@/lib/validation-center/types";

export const VALIDATION_ENGINES: ValidationEngineDefinition[] = [
  {
    id: "si_library_audit",
    label: "SI Library Audit",
    description:
      "Compare manufacturer charts against OneDrive exports, score compliance, and generate audit workbooks.",
    status: "active",
    inputRoles: [
      { role: "manufacturer_chart", label: "Manufacturer Chart", required: true },
      { role: "onedrive_export", label: "OneDrive Export", required: true },
    ],
  },
  {
    id: "si_library_external",
    label: "SI External Report Validation",
    description: "Validate external reports against the audited library baseline.",
    status: "planned",
    inputRoles: [{ role: "external_report", label: "External Report", required: true }],
  },
  {
    id: "id3_validation",
    label: "ID³ Validation",
    description: "Validate ID³ deliverables against program requirements.",
    status: "future",
    inputRoles: [],
  },
  {
    id: "oem_validation",
    label: "OEM Validation",
    description: "OEM-specific validation rules and deliverable checks.",
    status: "future",
    inputRoles: [],
  },
  {
    id: "document_validation",
    label: "Document Validation",
    description: "Document completeness and metadata validation.",
    status: "future",
    inputRoles: [],
  },
];

export function getValidationEngine(id: string): ValidationEngineDefinition | undefined {
  return VALIDATION_ENGINES.find((engine) => engine.id === id);
}

export function getActiveValidationEngines(): ValidationEngineDefinition[] {
  return VALIDATION_ENGINES.filter((engine) => engine.status === "active");
}
