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
export function fileViewHref(source: "company" | "task", id: string): string {
  return `/files/view/${source}/${id}`;
}
