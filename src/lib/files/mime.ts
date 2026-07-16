/** Browsers often report an EMPTY type for Office files (and octet-stream
 * for drag-drops), which the storage bucket's allowlist rejects. The
 * extension is the reliable signal — infer from it whenever the browser's
 * answer is missing or generic. */
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  csv: "text/csv",
  txt: "text/plain",
  html: "text/html",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function inferDocumentMime(fileName: string, browserType?: string | null): string {
  const trusted = browserType?.trim();
  if (trusted && trusted !== "application/octet-stream") return trusted;
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && EXT_MIME[ext]) || trusted || "application/octet-stream";
}
