import {
  DEFAULT_OPERATING_MODEL_PRESETS,
  GENERAL_OPERATING_MODEL,
} from "@/lib/operating-models/presets";
import type { TeamOperatingModelRecord } from "@/lib/operating-models/types";

let operatingModels: TeamOperatingModelRecord[] = [];

export function defaultOperatingModels(): TeamOperatingModelRecord[] {
  return DEFAULT_OPERATING_MODEL_PRESETS.map((m, i) => ({
    ...m,
    is_active: true,
    sort_order: i,
  }));
}

export function replaceOperatingModelsInStore(models: TeamOperatingModelRecord[]): void {
  operatingModels = models;
}

export function listOperatingModels(): TeamOperatingModelRecord[] {
  if (!operatingModels.length) {
    operatingModels = defaultOperatingModels();
  }
  return operatingModels.filter((m) => m.is_active !== false);
}

export function getOperatingModel(slug: string): TeamOperatingModelRecord | undefined {
  return listOperatingModels().find((m) => m.slug === slug);
}

export function getGeneralOperatingModel(): TeamOperatingModelRecord {
  return (
    listOperatingModels().find((m) => m.isGeneral || m.slug === GENERAL_OPERATING_MODEL.slug) ??
    GENERAL_OPERATING_MODEL
  );
}

export function upsertOperatingModelInStore(model: TeamOperatingModelRecord): void {
  const idx = operatingModels.findIndex((m) => m.slug === model.slug);
  if (idx >= 0) {
    operatingModels[idx] = model;
  } else {
    operatingModels.push(model);
  }
}

export function removeOperatingModelFromStore(slug: string): void {
  const general = GENERAL_OPERATING_MODEL.slug;
  if (slug === general) return;
  operatingModels = operatingModels.filter((m) => m.slug !== slug);
}
