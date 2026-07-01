/** Vercel serverless functions cap request bodies at ~4.5 MB. */
export const VERCEL_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const TASK_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const COMPANY_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const FEEDBACK_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const QA_KNOWLEDGE_MAX_BYTES = 50 * 1024 * 1024;

function isVercelDeployment(): boolean {
  return Boolean(process.env.VERCEL);
}

function readPublicLimit(
  envValue: string | undefined,
  fallback: number
): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getTaskFileMaxBytes(): number {
  if (isVercelDeployment()) return VERCEL_MAX_UPLOAD_BYTES;
  return readPublicLimit(
    process.env.NEXT_PUBLIC_MAX_TASK_FILE_BYTES,
    TASK_FILE_MAX_BYTES
  );
}

export function getCompanyDocumentMaxBytes(): number {
  if (isVercelDeployment()) return VERCEL_MAX_UPLOAD_BYTES;
  return readPublicLimit(
    process.env.NEXT_PUBLIC_MAX_COMPANY_DOCUMENT_BYTES,
    COMPANY_DOCUMENT_MAX_BYTES
  );
}

export function getFeedbackAttachmentMaxBytes(): number {
  if (isVercelDeployment()) return VERCEL_MAX_UPLOAD_BYTES;
  return readPublicLimit(
    process.env.NEXT_PUBLIC_MAX_FEEDBACK_ATTACHMENT_BYTES,
    FEEDBACK_ATTACHMENT_MAX_BYTES
  );
}

export function getQaKnowledgeMaxBytes(): number {
  if (isVercelDeployment()) return VERCEL_MAX_UPLOAD_BYTES;
  return readPublicLimit(
    process.env.NEXT_PUBLIC_MAX_QA_KNOWLEDGE_BYTES,
    QA_KNOWLEDGE_MAX_BYTES
  );
}

export function formatUploadLimitLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    const rounded = mb % 1 === 0 ? String(mb) : mb.toFixed(1);
    return `${rounded} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
