import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";

export type WorkCreationMode = "board" | "project" | "task";

export interface BoardWizardState {
  templateId: string;
  name: string;
  departmentId: string;
  description: string;
  qaRequired: boolean;
  filesRequired: boolean;
  addFirstTask: boolean;
  firstTaskTitle: string;
  firstTaskAssignee: string;
  firstTaskDueDate: string;
}
