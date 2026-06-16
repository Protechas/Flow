export type FilePreviewKind = "pdf" | "image" | "spreadsheet" | "text" | "unsupported";

export function getFilePreviewKind(fileName: string, mimeType?: string): FilePreviewKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";

  if (
    mimeType?.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)
  ) {
    return "image";
  }

  if (
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("excel") ||
    mimeType === "text/csv" ||
    ["xlsx", "xls", "csv"].includes(ext)
  ) {
    return "spreadsheet";
  }

  if (mimeType?.startsWith("text/") || ext === "txt") return "text";

  return "unsupported";
}
