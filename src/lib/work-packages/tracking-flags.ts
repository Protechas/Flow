import type { WorkPackage } from "@/types/flow";

export interface WorkPackageTrackingFlags {
  qaRequired: boolean;
  filesRequired: boolean;
}

/** Resolve typed flags with notes fallback for legacy rows. */
export function resolveWorkPackageTrackingFlags(
  pkg: Pick<WorkPackage, "qa_required" | "files_required" | "notes">
): WorkPackageTrackingFlags {
  const notes = pkg.notes ?? "";
  const qaFromNotes = notes.includes("QA required")
    ? true
    : notes.toLowerCase().includes("no qa")
      ? false
      : undefined;
  const filesFromNotes =
    notes.includes("Files required") || notes.includes("File uploads required")
      ? true
      : undefined;

  return {
    qaRequired: pkg.qa_required ?? qaFromNotes ?? true,
    filesRequired: pkg.files_required ?? filesFromNotes ?? false,
  };
}
