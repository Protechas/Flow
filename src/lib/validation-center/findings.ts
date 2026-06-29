import { isValidationDbEnabled } from "@/lib/validation-center/validation-persistence";
import { mapEngineFindingToEntity } from "@/lib/validation-center/finding-mapper";
import {
  getValidationFindingStats,
  listManufacturersFromFindings,
  filterFindings,
} from "@/lib/validation-center/findings-utils";
import {
  addMemoryFindings,
  getMemoryFinding,
  listMemoryFindings,
  listMemoryFindingsForRun,
  removeMemoryFindingsForRun,
  upsertMemoryFinding,
} from "@/lib/validation-center/store";
import type {
  ValidationEngineId,
  ValidationFinding,
  ValidationFindingFilters,
  ValidationFindingStatus,
  ValidationRootCause,
} from "@/lib/validation-center/types";

function ts() {
  return new Date().toISOString();
}

export { filterFindings, getValidationFindingStats, listManufacturersFromFindings };

export async function listValidationFindings(
  filters: ValidationFindingFilters = {}
): Promise<ValidationFinding[]> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }
  return filterFindings(listMemoryFindings(), filters);
}

export async function getValidationFinding(id: string): Promise<ValidationFinding | null> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }
  return getMemoryFinding(id);
}

export async function listFindingsForRun(runId: string): Promise<ValidationFinding[]> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }
  return listMemoryFindingsForRun(runId);
}

export async function importFindingsFromJobResult(
  runId: string,
  engineId: ValidationEngineId,
  rawFindings: unknown[]
): Promise<ValidationFinding[]> {
  const now = ts();
  removeMemoryFindingsForRun(runId);

  const entities = rawFindings
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => mapEngineFindingToEntity(runId, engineId, row, now));

  addMemoryFindings(entities);

  if (isValidationDbEnabled()) {
    const { persistValidationFindings } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await persistValidationFindings(runId, entities);
  }

  return entities;
}

export async function updateValidationFinding(
  id: string,
  patch: Partial<Pick<ValidationFinding, "status" | "root_cause">>
): Promise<ValidationFinding | null> {
  const existing = getMemoryFinding(id);
  if (!existing) return null;

  const updated: ValidationFinding = {
    ...existing,
    ...patch,
    updated_at: ts(),
  };
  upsertMemoryFinding(updated);

  if (isValidationDbEnabled()) {
    const { persistValidationFindingUpdate } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await persistValidationFindingUpdate(updated);
  }

  return updated;
}

export async function listCorrectionFindings(): Promise<ValidationFinding[]> {
  if (isValidationDbEnabled()) {
    const { hydrateValidationCenterFromDb } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await hydrateValidationCenterFromDb();
  }
  const { listFindingsWithTasks } = await import("@/lib/validation-center/task-bridge");
  return listFindingsWithTasks();
}

export async function listValidationCorrections(): Promise<
  import("@/lib/validation-center/types").ValidationCorrectionView[]
> {
  const findings = await listCorrectionFindings();
  const { enrichCorrectionViews } = await import("@/lib/validation-center/task-bridge");
  return enrichCorrectionViews(findings);
}

export type { ValidationFindingStatus, ValidationRootCause };
