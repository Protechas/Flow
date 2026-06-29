/**
 * @deprecated Use batch-import-engine.ts — kept for backward compatibility.
 */
export {
  classifyFileKind as classifyFile,
  extractRawManufacturer as extractManufacturer,
  isExcelUpload,
  validateBatchImport,
  getRunnableRows,
  fileKey,
  type BatchImportRow as ManufacturerFilePair,
} from "@/lib/validation-center/batch-import-engine";

import { validateBatchImport } from "@/lib/validation-center/batch-import-engine";

export function pairUploadedFiles(files: File[]) {
  return validateBatchImport(files).rows;
}

export function getReadyPairsFromFiles(files: File[]) {
  return validateBatchImport(files).rows.filter((r) => r.status === "ready" && r.mcFile && r.exportFile);
}

export type { FileKind as UploadFileKind } from "@/lib/validation-center/batch-import-engine";
