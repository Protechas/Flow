"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createValidationRun } from "@/lib/validation-center/runs";
import {
  setQaEngineFindingStatus,
  type QaEngineFindingStatus,
} from "@/lib/validation-center/qa-engine-findings";
import {
  addId3Rule,
  deleteId3Rule,
  updateId3Rule,
} from "@/lib/validation-center/id3-rules";

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function toUpload(file: File) {
  return {
    name: file.name,
    buffer: Buffer.from(await file.arrayBuffer()),
    mime_type: file.type || EXCEL_MIME,
  };
}

/** Upload files → run checks. MC chart required; reference files optional. */
export async function createQaEngineScanAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:create")) {
    return { ok: false as const, message: "You do not have permission to run QA scans" };
  }
  const mcFile = formData.get("manufacturer_chart") as File | null;
  if (!mcFile?.size) {
    return { ok: false as const, message: "Upload the MC chart (Excel or CSV)" };
  }
  const references = (formData.getAll("reference_files") as File[]).filter((f) => f?.size);

  try {
    const run = await createValidationRun({
      engine_id: "qa_engine",
      created_by: user.id,
      mc_file: await toUpload(mcFile),
      reference_files: await Promise.all(references.map(toUpload)),
    });
    revalidatePath("/qa-center/id3/engine");
    return { ok: true as const, runId: run.id };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Scan failed" };
  }
}

export async function setQaFindingStatusAction(id: string, status: QaEngineFindingStatus) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) {
    return { ok: false as const, message: "Not permitted" };
  }
  try {
    await setQaEngineFindingStatus(id, status);
    revalidatePath("/qa-center/id3/engine");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Update failed" };
  }
}

// ——— ID3 rules (Mark's no-code editor) ———————————————————————————————————

export async function addId3RuleAction(fields: Record<string, string>, notes: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:create")) {
    return { ok: false as const, message: "You do not have permission to edit rules" };
  }
  const cleaned = Object.fromEntries(
    Object.entries(fields)
      .map(([k, v]) => [k.trim(), String(v ?? "").trim()])
      .filter(([k]) => k)
  );
  if (Object.keys(cleaned).length === 0) {
    return { ok: false as const, message: "Fill in at least one field" };
  }
  try {
    await addId3Rule(cleaned, notes.trim() || null, user.id);
    revalidatePath("/qa-center/id3/rules");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not add rule" };
  }
}

export async function updateId3RuleAction(
  id: string,
  fields: Record<string, string>,
  notes: string
) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:create")) {
    return { ok: false as const, message: "You do not have permission to edit rules" };
  }
  const cleaned = Object.fromEntries(
    Object.entries(fields)
      .map(([k, v]) => [k.trim(), String(v ?? "").trim()])
      .filter(([k]) => k)
  );
  try {
    await updateId3Rule(id, cleaned, notes.trim() || null, user.id);
    revalidatePath("/qa-center/id3/rules");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not save rule" };
  }
}

export async function deleteId3RuleAction(id: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:create")) {
    return { ok: false as const, message: "You do not have permission to edit rules" };
  }
  try {
    await deleteId3Rule(id);
    revalidatePath("/qa-center/id3/rules");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not delete rule" };
  }
}
