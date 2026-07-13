import {
  downloadCompanyDocumentBuffer,
  getCompanyDocumentContent,
} from "@/lib/files/company-documents";
import type { CompanyDocument } from "@/types/flow";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isDocumentEditable(doc: CompanyDocument): boolean {
  const name = doc.file_name.toLowerCase();
  return (
    doc.mime_type === DOCX_MIME ||
    name.endsWith(".docx") ||
    doc.mime_type === "text/plain" ||
    name.endsWith(".txt") ||
    // Flow-native documents (authored in Flow) store an HTML snapshot as their file
    doc.mime_type === "text/html" ||
    name.endsWith(".html")
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/**
 * The editable HTML for a document: the saved in-Flow copy when it exists,
 * otherwise converted from the original file (.docx via mammoth, .txt wrapped
 * in paragraphs). Returns null for file types Flow can't edit.
 */
export async function getEditableDocumentHtml(
  doc: CompanyDocument
): Promise<{ html: string; fromOriginal: boolean } | null> {
  const saved = await getCompanyDocumentContent(doc.id);
  if (saved != null) return { html: saved, fromOriginal: false };

  const name = doc.file_name.toLowerCase();
  if (doc.mime_type === DOCX_MIME || name.endsWith(".docx")) {
    const buffer = await downloadCompanyDocumentBuffer(doc);
    const { default: mammoth } = await import("mammoth");
    const result = await mammoth.convertToHtml({ buffer });
    return { html: result.value, fromOriginal: true };
  }
  if (doc.mime_type === "text/plain" || name.endsWith(".txt")) {
    const buffer = await downloadCompanyDocumentBuffer(doc);
    const html = buffer
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
    return { html, fromOriginal: true };
  }
  if (doc.mime_type === "text/html" || name.endsWith(".html")) {
    const buffer = await downloadCompanyDocumentBuffer(doc);
    return { html: buffer.toString("utf8"), fromOriginal: true };
  }
  return null;
}
