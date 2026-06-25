import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";
import type { ProjectTemplateId } from "@/lib/templates/project-templates";

export type BulkMatrixOrder =
  | "make_year_model"
  | "year_make_model"
  | "make_year_task"
  | "custom";

export const BULK_MATRIX_ORDER_OPTIONS: {
  value: BulkMatrixOrder;
  label: string;
  description: string;
}[] = [
  {
    value: "make_year_model",
    label: "Make → Year → Model",
    description: "OEM first, then model years, then models/tasks",
  },
  {
    value: "year_make_model",
    label: "Year → Make → Model",
    description: "Group by year at the top level, then make and model",
  },
  {
    value: "make_year_task",
    label: "Make → Year → Task",
    description: "OEM and year with standard or custom task names",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Same as Make → Year → Model with flexible naming",
  },
];

export interface BulkMatrixDraft {
  name: string;
  departmentId: string;
  teamId: string;
  ownerId: string;
  projectType: string;
  templateId: ProjectTemplateId;
  description: string;
  priority: WorkPriority;
  complexity: ForecastComplexityLevel;
  manualDueDate: string;
  matrixOrder: BulkMatrixOrder;
  selectedMakes: string[];
  selectedYears: number[];
  models: string[];
  useModelCount: boolean;
  modelCountPerGroup: number;
  docsPerTask: number;
  qaRequired: boolean;
  filesRequired: boolean;
  dailyTracking: boolean;
}

export const COMMON_MATRIX_YEARS = Array.from({ length: 12 }, (_, i) => 2017 + i);

export function emptyBulkMatrixDraft(
  defaults: Partial<BulkMatrixDraft> = {}
): BulkMatrixDraft {
  const y = new Date().getFullYear();
  return {
    name: "",
    departmentId: "",
    teamId: "",
    ownerId: "__none__",
    projectType: "special_functions",
    templateId: "sf_phase_1",
    description: "",
    priority: "medium",
    complexity: "standard",
    manualDueDate: "",
    matrixOrder: "make_year_model",
    selectedMakes: [],
    selectedYears: [y, y + 1],
    models: [],
    useModelCount: true,
    modelCountPerGroup: 1,
    docsPerTask: 10,
    qaRequired: true,
    filesRequired: false,
    dailyTracking: false,
    ...defaults,
  };
}

export function parseYearList(text: string): number[] {
  return text
    .split(/[\n,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((y) => y >= 1990 && y <= 2100);
}
