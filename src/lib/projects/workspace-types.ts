export type WorkspaceColumnType =
  | "status"
  | "person"
  | "date"
  | "number"
  | "text"
  | "dropdown"
  | "checkbox"
  | "files"
  | "formula"
  | "progress"
  | "hours"
  | "currency"
  | "tags"
  | "custom_metric";

/** Maps to WorkPackage fields when set — reporting still uses the same backend. */
export type WorkspaceBuiltInField =
  | "title"
  | "assigned_to"
  | "status"
  | "priority"
  | "due_date"
  | "estimated_hours"
  | "actual_hours"
  | "estimated_document_count"
  | "complexity_level"
  | "file_count"
  | "qa_status"
  | "notes"
  | "progress"
  | "created_at";

export interface WorkspaceColumnDef {
  id: string;
  label: string;
  type: WorkspaceColumnType;
  builtIn?: WorkspaceBuiltInField;
  options?: string[];
  width?: number;
  visible: boolean;
}

export interface ProjectTrackingFlags {
  qaRequired: boolean;
  fileUploads: boolean;
  dailyReports: boolean;
  forecasting: boolean;
  productionTracking: boolean;
  timeTracking: boolean;
  wrapUps: boolean;
  customMetrics: boolean;
}

export interface ProjectWorkspaceConfig {
  version: 1;
  templateId: string;
  tracking: ProjectTrackingFlags;
  columns: WorkspaceColumnDef[];
}

export interface WorkspaceTemplate {
  id: string;
  label: string;
  description: string;
  projectType: string;
  sections: string[];
  tracking: ProjectTrackingFlags;
  columns: WorkspaceColumnDef[];
}

export interface WorkspaceKpiCard {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warn" | "danger";
}
