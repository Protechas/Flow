import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";

export type WorkCreationMode = "board" | "project" | "task";

export interface BoardWizardState {
  templateId: string;
  name: string;
  departmentId: string;
  description: string;
}

export interface ProjectWizardState {
  projectCreationMode: "from_template" | "blank";
  enterpriseTemplateId: string;
  templateId: string;
  name: string;
  departmentId: string;
  boardProjectId: string;
  estimatedDocuments: string;
  manualDueDate: string;
  ownerId: string;
  complexity: ForecastComplexityLevel;
  priority: WorkPriority;
  description: string;
}

export interface TaskWizardState {
  name: string;
  projectId: string;
  newProjectName: string;
  projectMode: "existing" | "new";
  boardProjectId: string;
  manufacturerName: string;
  year: string;
  assigneeId: string;
  estimatedDocuments: string;
  complexity: ForecastComplexityLevel;
  priority: WorkPriority;
}
