/** Serve file in browser when possible (PDF, images, etc.) */
export function inlineFileContentDisposition(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  return `inline; filename="${safe}"`;
}

export function attachmentFileContentDisposition(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  return `attachment; filename="${safe}"`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/"/g, "").replace(/[\r\n]/g, "");
}
