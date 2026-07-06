import type { TaskFileUpload } from "@/types/flow";

export function taskFileDownloadHref(fileId: string): string {
  return `/api/files/${fileId}`;
}

/** True when the upload's content can still be served (storage or in-memory demo data). */
export function taskFileHasContent(
  file: Pick<TaskFileUpload, "storage_path" | "file_data_base64">
): boolean {
  return Boolean(file.storage_path || file.file_data_base64);
}

export function companyDocumentDownloadHref(documentId: string): string {
  return `/api/documents/${documentId}`;
}

export function taskFileDownloadHrefWithAttachment(fileId: string): string {
  return `/api/files/${fileId}?download=1`;
}

export function companyDocumentDownloadHrefWithAttachment(documentId: string): string {
  return `/api/documents/${documentId}?download=1`;
}

/** In-app viewer — opens PDF, Excel, images, and text in the browser */
export function fileViewHref(
  source: "company" | "task",
  id: string,
  opts?: { employee?: boolean }
): string {
  if (opts?.employee) return `/work/files/view/${source}/${id}`;
  return `/files/view/${source}/${id}`;
}
