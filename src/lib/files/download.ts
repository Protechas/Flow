export function taskFileDownloadHref(fileId: string): string {
  return `/api/files/${fileId}`;
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
