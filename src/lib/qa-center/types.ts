/** QA Center — enterprise SI validation platform types */

export type QaCenterNavId =
  | "dashboard"
  | "upload"
  | "validation"
  | "review"
  | "knowledge"
  | "rules"
  | "reports"
  | "analytics"
  | "settings";

export interface QaCenterNavItem {
  id: QaCenterNavId;
  href: string;
  label: string;
  description: string;
  permissions: ("validation:view" | "validation:create" | "validation:export" | "validation:manage_settings" | "qa:review" | "qa:view")[];
}

export type QaKnowledgeCategory =
  | "manufacturer_component_chart"
  | "si_library_sop"
  | "si_content_sop"
  | "adobe_formatting_sop"
  | "safety_acronyms"
  | "id3_mapping"
  | "pcs_workbook"
  | "ro_response_templates"
  | "training"
  | "gold_standard"
  | "other";

export const QA_KNOWLEDGE_CATEGORY_LABELS: Record<QaKnowledgeCategory, string> = {
  manufacturer_component_chart: "Manufacturer Component Chart",
  si_library_sop: "SI Library SOP",
  si_content_sop: "SI Content SOP",
  adobe_formatting_sop: "Adobe Formatting SOP",
  safety_acronyms: "Safety System Acronyms",
  id3_mapping: "ID³ Mapping Workbook",
  pcs_workbook: "PCS Workbook",
  ro_response_templates: "RO Response Templates",
  training: "Internal Training",
  gold_standard: "Gold Standard Document",
  other: "Other Reference",
};

export interface QaKnowledgeVersion {
  id: string;
  entry_id: string;
  version_number: number;
  file_name: string | null;
  storage_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  is_active: boolean;
  change_notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  index_metadata?: QaKnowledgeIndexMetadata | null;
}

export interface QaKnowledgeIndexMetadata {
  manufacturers?: string[];
  search_terms?: string[];
  file_names?: string[];
  indexed_at?: string;
}

export interface QaKnowledgeEntry {
  id: string;
  entry_key: string | null;
  category: QaKnowledgeCategory;
  title: string;
  description: string | null;
  tags: string[];
  active_version_id: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  index_metadata?: QaKnowledgeIndexMetadata | null;
  active_version?: QaKnowledgeVersion | null;
}

export interface QaGoldStandard {
  id: string;
  title: string;
  manufacturer: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  component: string | null;
  source_run_id: string | null;
  validation_score: number | null;
  storage_path: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_active: boolean;
  created_at: string;
}

export type QaValidationLayer = "file" | "content" | "mcc" | "business" | "scoring";

export type QaDocumentVerdict = "pass" | "warning" | "fail" | "critical";

export type QaIssueSeverity = "critical" | "high" | "medium" | "low" | "info";

export type QaIssueStatus = "open" | "assigned" | "in_progress" | "resolved" | "dismissed";

export interface QaValidationIssue {
  id: string;
  severity: QaIssueSeverity;
  category: string;
  rule_key: string | null;
  rule_violated: string;
  evidence: string;
  why_failed: string;
  suggested_fix: string;
  document_ref: string | null;
  assigned_analyst_id: string | null;
  status: QaIssueStatus;
  reviewer_notes: string | null;
  ai_confidence: number | null;
  ai_explanation: string | null;
}

export interface QaValidationRule {
  id: string;
  rule_key: string;
  layer: QaValidationLayer;
  label: string;
  description: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  weight: number;
  updated_by: string | null;
  updated_at: string;
}

export type QaDocumentValidationStatus = "queued" | "processing" | "completed" | "failed";

export interface QaDocumentValidation {
  id: string;
  status: QaDocumentValidationStatus;
  upload_batch_id: string | null;
  file_name: string;
  storage_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  manufacturer: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  component: string | null;
  analyst_id: string | null;
  assigned_analyst_id: string | null;
  project_id: string | null;
  work_package_id: string | null;
  qa_score: number | null;
  confidence_pct: number | null;
  verdict: QaDocumentVerdict | null;
  estimated_review_minutes: number | null;
  layer_results: Record<string, unknown>;
  ai_review: Record<string, unknown>;
  issues: QaValidationIssue[];
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface QaCenterDashboardStats {
  filesSubmitted: number;
  preValidationPassed: number;
  auditRunsSubmitted: number;
  passed: number;
  warnings: number;
  failed: number;
  critical: number;
  averageQaScore: number | null;
  averageReviewMinutes: number | null;
  reviewQueueCount: number;
  validationQueueCount: number;
  uploadQueueCount: number;
  openFindings: number;
  knowledgeEntries: number;
  goldStandards: number;
  libraryReady: boolean;
  libraryLoadedCount: number;
  libraryTotalCount: number;
}

export type QaCenterRole = "admin" | "qa_manager" | "reviewer" | "analyst" | "read_only";
