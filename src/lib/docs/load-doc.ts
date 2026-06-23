import { readFile } from "fs/promises";
import path from "path";
import { getDocBySlug, type DocEntry } from "@/lib/docs/catalog";

const DOCS_DIR = path.join(process.cwd(), "docs");

export async function loadDocMarkdown(entry: DocEntry): Promise<string> {
  const filePath = path.join(DOCS_DIR, entry.file);
  return readFile(filePath, "utf8");
}

export async function loadDocBySlug(slug: string): Promise<{ entry: DocEntry; markdown: string } | null> {
  const entry = getDocBySlug(slug);
  if (!entry) return null;
  try {
    const markdown = await loadDocMarkdown(entry);
    return { entry, markdown };
  } catch {
    return null;
  }
}
