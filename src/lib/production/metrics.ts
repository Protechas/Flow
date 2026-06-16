import type { ProductionMetrics } from "@/types/flow";

export function computeProductionMetrics(
  totalTaskMinutes: number,
  uploadedFileCount: number
): ProductionMetrics {
  const safeFiles = Math.max(uploadedFileCount, 0);
  const safeMinutes = Math.max(totalTaskMinutes, 0);

  const averageMinutesPerDocument =
    safeFiles > 0 ? Math.round((safeMinutes / safeFiles) * 100) / 100 : 0;

  const documentsPerHour =
    safeMinutes > 0
      ? Math.round((safeFiles / (safeMinutes / 60)) * 100) / 100
      : 0;

  const productivityRate =
    safeMinutes > 0
      ? Math.round(documentsPerHour * 10) / 10
      : 0;

  return {
    totalTaskMinutes: safeMinutes,
    uploadedFileCount: safeFiles,
    averageMinutesPerDocument,
    documentsPerHour,
    productivityRate,
  };
}

export function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
