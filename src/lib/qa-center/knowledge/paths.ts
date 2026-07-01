import path from "node:path";

/** Root directory for QA Center reference documents (not committed — sync via npm run sync:qa-knowledge). */
export function getKnowledgeLibraryRoot(): string {
  return path.join(process.cwd(), "data", "knowledge-library");
}

export function resolveKnowledgeRelativePath(relativePath: string): string {
  const root = getKnowledgeLibraryRoot();
  const normalized = relativePath.replace(/\\/g, "/");
  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error("Invalid knowledge library path");
  }
  return resolved;
}
