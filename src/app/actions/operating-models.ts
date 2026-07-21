"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import {
  deleteOperatingModelFromSupabase,
  persistOperatingModelToSupabase,
} from "@/lib/data/operating-models-db";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { inputToModel, type OperatingModelInput } from "@/lib/operating-models/form";
import {
  getOperatingModel,
  listOperatingModels,
  removeOperatingModelFromStore,
  upsertOperatingModelInStore,
} from "@/lib/operating-models/store";
import { isValidOperatingModelSlug, slugifyOperatingModel } from "@/lib/operating-models/slug";
import { GENERAL_OPERATING_MODEL } from "@/lib/operating-models/presets";

const REVALIDATE_PATHS = [
  "/settings/operating-models",
  "/teams",
  "/projects",
  "/operations",
  "/executive",
  "/reports",
];

function revalidateOperatingModelPaths(slug?: string) {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
  if (slug) revalidatePath(`/teams/${slug}`);
  revalidatePath("/settings/operating-models", "layout");
}

export type { OperatingModelInput } from "@/lib/operating-models/form";

export async function listOperatingModelsAction() {
  await requirePermission("settings:manage");
  await hydrateOperatingModels();
  return listOperatingModels();
}

export async function getOperatingModelAction(slug: string) {
  await requirePermission("settings:manage");
  await hydrateOperatingModels();
  return getOperatingModel(slug) ?? null;
}

export async function saveOperatingModelAction(input: OperatingModelInput) {
  const user = await requirePermission("settings:manage");
  const slug = input.slug.trim();
  if (!isValidOperatingModelSlug(slug)) {
    throw new Error("Slug must use lowercase letters, numbers, and hyphens.");
  }
  if (!input.label.trim()) throw new Error("Label is required.");
  if (!input.kpiIds.length) throw new Error("Select at least one KPI.");

  // Merge over the existing model so config the Settings form doesn't render
  // (wrapUpFields, workspace, future fields) survives a save instead of being
  // silently reset — same preserve-unknown-keys contract as the QA rule editor.
  await hydrateOperatingModels();
  const existing = getOperatingModel(slug);
  const model = { ...existing, ...inputToModel(input) };
  const record = {
    ...model,
    is_active: input.is_active ?? true,
    sort_order: existing?.sort_order ?? 0,
  };

  upsertOperatingModelInStore(record);
  await persistOperatingModelToSupabase(record, user.id);
  revalidateOperatingModelPaths(slug);
  return { slug };
}

export async function deleteOperatingModelAction(slug: string) {
  await requirePermission("settings:manage");
  if (slug === GENERAL_OPERATING_MODEL.slug) {
    throw new Error("The General Operations model cannot be deleted.");
  }
  await hydrateOperatingModels();
  removeOperatingModelFromStore(slug);
  await deleteOperatingModelFromSupabase(slug);
  revalidateOperatingModelPaths();
}

export async function suggestOperatingModelSlugAction(label: string) {
  await requirePermission("settings:manage");
  return slugifyOperatingModel(label);
}
