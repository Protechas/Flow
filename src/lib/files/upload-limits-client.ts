import {
  COMPANY_DOCUMENT_MAX_BYTES,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  QA_KNOWLEDGE_MAX_BYTES,
  TASK_FILE_MAX_BYTES,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits";

function readPublicLimit(
  envValue: string | undefined,
  fallback: number
): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const clientTaskFileMaxBytes = readPublicLimit(
  process.env.NEXT_PUBLIC_MAX_TASK_FILE_BYTES,
  TASK_FILE_MAX_BYTES
);

export const clientCompanyDocumentMaxBytes = readPublicLimit(
  process.env.NEXT_PUBLIC_MAX_COMPANY_DOCUMENT_BYTES,
  COMPANY_DOCUMENT_MAX_BYTES
);

export const clientFeedbackAttachmentMaxBytes = readPublicLimit(
  process.env.NEXT_PUBLIC_MAX_FEEDBACK_ATTACHMENT_BYTES,
  FEEDBACK_ATTACHMENT_MAX_BYTES
);

export const clientQaKnowledgeMaxBytes = readPublicLimit(
  process.env.NEXT_PUBLIC_MAX_QA_KNOWLEDGE_BYTES,
  QA_KNOWLEDGE_MAX_BYTES
);

export { formatUploadLimitLabel };
