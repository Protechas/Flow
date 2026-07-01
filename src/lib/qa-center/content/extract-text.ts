import * as XLSX from "xlsx";

const DEFAULT_SI_SECTIONS = [
  "system description",
  "removal",
  "installation",
  "calibration",
  "reference",
  "specification",
];

/** Best-effort text extraction for deterministic QA checks (no OCR). */
export function extractDocumentText(buffer: Buffer, fileName: string, mimeType?: string | null): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = (mimeType ?? "").toLowerCase();

  try {
    if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet")) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        parts.push(XLSX.utils.sheet_to_csv(sheet));
      }
      return parts.join("\n");
    }
  } catch {
    // fall through to raw scan
  }

  const raw = buffer.toString("latin1");
  if (ext === "pdf" || mime.includes("pdf")) {
    const textMatches = raw.match(/\(([^()\\]{3,120})\)/g) ?? [];
    const extracted = textMatches
      .map((m) => m.slice(1, -1))
      .filter((t) => /[A-Za-z]{3,}/.test(t))
      .join(" ");
    return `${raw.slice(0, 5000)} ${extracted}`.slice(0, 200_000);
  }

  if (ext === "docx" || mime.includes("wordprocessingml")) {
    return raw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 200_000);
  }

  if (ext === "zip") {
    const names = raw.match(/[\w\s./-]+\.(xlsx|pdf|docx)/gi) ?? [];
    return names.join("\n");
  }

  return raw.slice(0, 100_000);
}

export function findMissingSections(
  text: string,
  configuredSections: string[] = []
): string[] {
  const sections = configuredSections.length > 0 ? configuredSections : DEFAULT_SI_SECTIONS;
  const haystack = text.toLowerCase();
  return sections.filter((section) => !haystack.includes(section.toLowerCase()));
}

/** Heuristic: PDF MediaBox width should exceed height for landscape. */
export function pdfAppearsPortrait(buffer: Buffer): boolean | null {
  const raw = buffer.toString("latin1");
  const match = raw.match(/\/MediaBox\s*\[\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\]/);
  if (!match) return null;
  const width = Math.abs(Number(match[3]) - Number(match[1]));
  const height = Math.abs(Number(match[4]) - Number(match[2]));
  if (!width || !height) return null;
  return height > width;
}

export function matchesNamingPattern(fileName: string, pattern: string | null): boolean {
  if (!pattern) {
    return /^[A-Za-z0-9][A-Za-z0-9_\-. ]+\.(pdf|docx|xlsx|zip)$/i.test(fileName);
  }
  try {
    return new RegExp(pattern, "i").test(fileName);
  } catch {
    return true;
  }
}
