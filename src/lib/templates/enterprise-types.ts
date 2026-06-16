import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";

export interface EnterpriseTaskTemplate {
  key: string;
  title: string;
  description?: string;
  status: "not_started" | "assigned";
  priority: WorkPriority;
  estimated_document_count?: number;
  complexity_level?: ForecastComplexityLevel;
  estimated_hours?: number;
  sort_order: number;
  requires_qa: boolean;
  requires_files: boolean;
}

export interface EnterpriseProjectTemplate {
  id: string;
  label: string;
  description: string;
  useCases: string[];
  category: string;
  projectType: string;
  builtin: boolean;
  archived: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Empty = compatible with all departments */
  departmentIds: string[];
  defaultPriority: WorkPriority;
  defaultComplexity: ForecastComplexityLevel;
  defaultEstimatedDocuments?: number;
  forecastingEnabled: boolean;
  qaEnabled: boolean;
  fileUploadsRequired: boolean;
  wrapUpsEnabled: boolean;
  workflowManufacturerName: string;
  tasks: EnterpriseTaskTemplate[];
  metrics: {
    projectsCreated: number;
    lastUsedAt: string | null;
  };
}

export interface CreateProjectFromTemplateInput {
  name: string;
  templateId: string;
  departmentId: string;
  teamId: string;
  ownerId?: string | null;
  description?: string | null;
  boardProjectId?: string | null;
  boardName?: string | null;
}

export interface SaveCustomTemplateInput {
  label: string;
  description: string;
  useCases: string[];
  category: string;
  projectType: string;
  departmentIds: string[];
  defaultPriority: WorkPriority;
  defaultComplexity: ForecastComplexityLevel;
  defaultEstimatedDocuments?: number;
  forecastingEnabled: boolean;
  qaEnabled: boolean;
  fileUploadsRequired: boolean;
  wrapUpsEnabled: boolean;
  tasks: EnterpriseTaskTemplate[];
}
