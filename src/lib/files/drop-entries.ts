/**
 * Collect File objects from a drop, walking dropped FOLDERS recursively —
 * dragging a whole folder tree uploads every file inside it (Michael's hub
 * ask) instead of silently uploading nothing. Falls back to the plain file
 * list when the entries API is unavailable (older browsers, synthetic drops).
 */
export const MAX_DROPPED_FILES = 500;

export async function collectDroppedFiles(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((item) =>
      typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null
    )
    .filter((e): e is FileSystemEntry => e != null);

  // No directory among the entries → the plain FileList is already right.
  if (!entries.length || entries.every((e) => e.isFile)) {
    return Array.from(dt.files);
  }

  const out: File[] = [];

  async function walk(entry: FileSystemEntry): Promise<void> {
    if (out.length >= MAX_DROPPED_FILES) return;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject)
      );
      out.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches; keep reading until empty.
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject)
        );
        for (const child of batch) await walk(child);
      } while (batch.length > 0 && out.length < MAX_DROPPED_FILES);
    }
  }

  for (const entry of entries) await walk(entry);
  return out;
}
