import type { BulkMatrixDraft } from "@/lib/work-creation/bulk-matrix-types";

export interface SavedBulkMatrixTemplate {
  id: string;
  label: string;
  description: string;
  savedAt: string;
  config: Pick<
    BulkMatrixDraft,
    | "matrixOrder"
    | "selectedMakes"
    | "selectedYears"
    | "models"
    | "useModelCount"
    | "modelCountPerGroup"
    | "docsPerTask"
    | "qaRequired"
    | "filesRequired"
    | "dailyTracking"
    | "projectType"
    | "templateId"
    | "complexity"
  >;
}

const STORAGE_KEY = "flow-bulk-matrix-templates-v1";

export const BUILTIN_BULK_MATRIX_TEMPLATES: SavedBulkMatrixTemplate[] = [
  {
    id: "builtin-si-ymm",
    label: "Standard SI Year/Make Build",
    description: "7 OEMs × recent years × unit tasks",
    savedAt: "",
    config: {
      matrixOrder: "make_year_model",
      selectedMakes: ["Toyota", "Honda", "Ford", "Nissan", "Chevrolet", "Mercedes", "BMW"],
      selectedYears: [2024, 2025, 2026],
      models: [],
      useModelCount: true,
      modelCountPerGroup: 1,
      docsPerTask: 25,
      qaRequired: true,
      filesRequired: true,
      dailyTracking: true,
      projectType: "si_corrections",
      templateId: "si_corrections",
      complexity: "standard",
    },
  },
  {
    id: "builtin-adas",
    label: "ADAS Year/Make Build",
    description: "Workstream-style ADAS validation matrix",
    savedAt: "",
    config: {
      matrixOrder: "make_year_model",
      selectedMakes: ["Toyota", "Honda", "Ford"],
      selectedYears: [2025, 2026],
      models: ["Documentation", "Validation", "QA Sign-off"],
      useModelCount: false,
      modelCountPerGroup: 1,
      docsPerTask: 15,
      qaRequired: true,
      filesRequired: false,
      dailyTracking: false,
      projectType: "adas",
      templateId: "adas_2026",
      complexity: "complex",
    },
  },
  {
    id: "builtin-sf",
    label: "Special Functions Package",
    description: "Full OEM × 2017–2026 matrix",
    savedAt: "",
    config: {
      matrixOrder: "make_year_model",
      selectedMakes: ["Toyota", "Honda", "Ford", "Nissan", "Chevrolet", "Mercedes", "BMW"],
      selectedYears: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
      models: [],
      useModelCount: true,
      modelCountPerGroup: 1,
      docsPerTask: 10,
      qaRequired: true,
      filesRequired: false,
      dailyTracking: false,
      projectType: "special_functions",
      templateId: "sf_phase_1",
      complexity: "standard",
    },
  },
];

export function listBulkMatrixTemplates(): SavedBulkMatrixTemplate[] {
  if (typeof window === "undefined") return sortTemplates(BUILTIN_BULK_MATRIX_TEMPLATES);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved: SavedBulkMatrixTemplate[] = raw ? JSON.parse(raw) : [];
    return sortTemplates([
      ...BUILTIN_BULK_MATRIX_TEMPLATES,
      ...saved.filter((t) => !t.id.startsWith("builtin-")),
    ]);
  } catch {
    return sortTemplates([...BUILTIN_BULK_MATRIX_TEMPLATES]);
  }
}

function sortTemplates(templates: SavedBulkMatrixTemplate[]) {
  return [...templates].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

export function saveBulkMatrixTemplate(
  label: string,
  config: SavedBulkMatrixTemplate["config"]
): SavedBulkMatrixTemplate {
  const entry: SavedBulkMatrixTemplate = {
    id: `user-${Date.now()}`,
    label,
    description: "Custom saved structure",
    savedAt: new Date().toISOString(),
    config,
  };
  if (typeof window === "undefined") return entry;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved: SavedBulkMatrixTemplate[] = raw ? JSON.parse(raw) : [];
    saved.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* ignore */
  }
  return entry;
}
