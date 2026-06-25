import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";
import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import type { WorkStructureMode } from "@/lib/work-packages/smart-labels";

export interface PhaseDraft {
  label: string;
}

export interface TaskDraft {
  title: string;
  assigneeId?: string | null;
  estimatedDocuments?: number | null;
  priority?: WorkPriority;
  qaRequired?: boolean;
  filesRequired?: boolean;
  dueDate?: string | null;
  notes?: string | null;
}

export type TaskSetupMode = "manual" | "template" | "copy";

export interface WorkPackageDraft {
  id: string;
  name: string;
  phases: PhaseDraft[];
  tasks: TaskDraft[];
  taskSetupMode: TaskSetupMode;
  copyFromPackageId?: string | null;
}

export interface TrackingRequirementsDraft {
  estimatedDocuments: string;
  estimatedHours: string;
  qaRequired: boolean;
  filesRequired: boolean;
  dailyTracking: boolean;
  customMetrics: string[];
}

export interface ProjectCreationDraft {
  name: string;
  departmentId: string;
  teamId: string;
  ownerId: string;
  projectType: string;
  templateId: ProjectTemplateId;
  enterpriseTemplateId: string;
  structureMode: WorkStructureMode;
  description: string;
  priority: WorkPriority;
  complexity: ForecastComplexityLevel;
  manualDueDate: string;
  packages: WorkPackageDraft[];
  tracking: TrackingRequirementsDraft;
}

export const STANDARD_TASK_TEMPLATES: Record<string, string[]> = {
  si_corrections: ["SI audit", "Correction entry", "Peer review", "QA sign-off"],
  special_functions: ["Research", "Documentation", "Validation", "QA review"],
  adas: ["Requirements review", "Documentation", "Validation test", "QA sign-off"],
  research: ["Discovery", "Analysis", "Deliverable draft", "Review"],
  custom: ["Planning", "Execution", "Review"],
  training: ["Content draft", "Review", "Delivery", "Assessment"],
};

export function emptyPackageDraft(id?: string): WorkPackageDraft {
  return {
    id: id ?? `pkg-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    phases: [{ label: String(new Date().getFullYear()) }],
    tasks: [],
    taskSetupMode: "manual",
  };
}

export function emptyProjectCreationDraft(): ProjectCreationDraft {
  const year = String(new Date().getFullYear());
  return {
    name: "",
    departmentId: "",
    teamId: "",
    ownerId: "__none__",
    projectType: "custom",
    templateId: "custom",
    enterpriseTemplateId: "",
    structureMode: "custom",
    description: "",
    priority: "medium",
    complexity: "standard",
    manualDueDate: "",
    packages: [emptyPackageDraft()],
    tracking: {
      estimatedDocuments: "",
      estimatedHours: "",
      qaRequired: true,
      filesRequired: false,
      dailyTracking: false,
      customMetrics: [],
    },
  };
}

export function parseBulkLines(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function phaseLabelToYear(label: string, index: number): number {
  const trimmed = label.trim();
  const match = trimmed.match(/^(\d{4})$/);
  if (match) {
    const y = parseInt(match[1], 10);
    if (y >= 1990 && y <= 2100) return y;
  }
  return new Date().getFullYear() + index;
}
