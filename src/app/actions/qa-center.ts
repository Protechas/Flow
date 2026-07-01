"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireFeaturePermission, requirePagePermission } from "@/lib/auth/guard";
import {
  QA_KNOWLEDGE_ACCEPTED_EXTENSIONS,
  QA_KNOWLEDGE_CATEGORY_OPTIONS,
} from "@/lib/qa-center/knowledge/catalog";
import {
  createKnowledgeEntry,
  listKnowledgeEntries,
  listKnowledgeVersions,
  setActiveKnowledgeVersion,
  uploadKnowledgeVersion,
} from "@/lib/qa-center/knowledge/store";
import { listValidationRulesHydrated, updateValidationRule } from "@/lib/qa-center/rules/engine";
import type { QaKnowledgeCategory, QaDocumentValidation } from "@/lib/qa-center/types";
import { getQaKnowledgeMaxBytes, formatUploadLimitLabel } from "@/lib/files/upload-limits";
import {
  createDocumentValidation,
  listDocumentValidations,
} from "@/lib/qa-center/validations/db";
import {
  processDocumentValidationBatch,
  processPendingDocumentValidations,
} from "@/lib/qa-center/validations/processor";
import {
  guessManufacturerFromFileName,
  newUploadBatchId,
  storeIntakeFile,
} from "@/lib/qa-center/validations/storage";

const QA_PATHS = [
  "/qa-center",
  "/qa-center/upload",
  "/qa-center/validation",
  "/qa-center/review",
  "/qa-center/knowledge",
  "/qa-center/rules",
  "/qa-center/reports",
  "/qa-center/analytics",
  "/qa-center/settings",
];

function revalidateQaCenter() {
  for (const p of QA_PATHS) revalidatePath(p);
}

function isAllowedExtension(fileName: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return QA_KNOWLEDGE_ACCEPTED_EXTENSIONS.includes(ext as (typeof QA_KNOWLEDGE_ACCEPTED_EXTENSIONS)[number]);
}

export async function listKnowledgeEntriesAction() {
  await requirePagePermission("validation:view");
  return listKnowledgeEntries();
}

export async function listKnowledgeVersionsAction(entryId: string) {
  await requirePagePermission("validation:view");
  return listKnowledgeVersions(entryId);
}

export async function uploadKnowledgeDocumentAction(formData: FormData) {
  const user = await requireFeaturePermission("qa-center", "manage_rules");

  const entryId = String(formData.get("entryId") ?? "").trim();
  const file = formData.get("file");
  const changeNotes = String(formData.get("changeNotes") ?? "").trim() || null;
  const setActive = formData.get("setActive") !== "false";

  if (!entryId) return { ok: false as const, message: "Select a knowledge entry." };
  if (!(file instanceof File)) return { ok: false as const, message: "Choose a file to upload." };
  if (!isAllowedExtension(file.name)) {
    return {
      ok: false as const,
      message: `Accepted types: ${QA_KNOWLEDGE_ACCEPTED_EXTENSIONS.join(", ")}`,
    };
  }

  const maxBytes = getQaKnowledgeMaxBytes();
  if (file.size > maxBytes) {
    return {
      ok: false as const,
      message: `File must be ${formatUploadLimitLabel(maxBytes)} or smaller.`,
    };
  }

  const entries = await listKnowledgeEntries();
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false as const, message: "Knowledge entry not found." };

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadKnowledgeVersion({
    entry_id: entryId,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    buffer,
    change_notes: changeNotes,
    uploaded_by: user.id,
    set_active: setActive,
    category: entry.category,
  });

  revalidateQaCenter();
  return { ok: true as const };
}

export async function createKnowledgeEntryAction(input: {
  category: QaKnowledgeCategory;
  title: string;
  description?: string;
}) {
  const user = await requirePagePermission("validation:manage_settings");
  if (!input.title.trim()) return { ok: false as const, message: "Title is required." };

  const entry = await createKnowledgeEntry({
    category: input.category,
    title: input.title.trim(),
    description: input.description?.trim(),
    created_by: user.id,
    tags: [input.category],
  });

  revalidateQaCenter();
  return { ok: true as const, entryId: entry.id };
}

export async function activateKnowledgeVersionAction(versionId: string) {
  await requirePagePermission("validation:manage_settings");
  const updated = await setActiveKnowledgeVersion(versionId);
  if (!updated) return { ok: false as const, message: "Version not found." };
  revalidateQaCenter();
  return { ok: true as const };
}

export async function listQaRulesAction() {
  await requirePagePermission("validation:manage_settings");
  return listValidationRulesHydrated();
}

export async function updateQaRuleAction(
  ruleKey: string,
  updates: {
    enabled?: boolean;
    weight?: number;
    config?: Record<string, unknown>;
  }
) {
  const user = await requirePagePermission("validation:manage_settings");
  const updated = await updateValidationRule(ruleKey, updates, user.id);
  if (!updated) throw new Error("Rule not found");
  revalidateQaCenter();
  return updated;
}

export async function listDocumentValidationsAction(): Promise<QaDocumentValidation[]> {
  await requirePagePermission("validation:view");
  return listDocumentValidations(100);
}

export async function submitDocumentsForValidationAction(formData: FormData) {
  const user = await requireFeaturePermission("qa-center", "upload_audit");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const manufacturerHint = String(formData.get("manufacturer") ?? "").trim() || null;

  if (files.length === 0) {
    return { ok: false as const, message: "Select at least one file." };
  }

  const maxBytes = getQaKnowledgeMaxBytes();
  for (const file of files) {
    if (!isAllowedExtension(file.name)) {
      return { ok: false as const, message: `Unsupported file type: ${file.name}` };
    }
    if (file.size > maxBytes) {
      return {
        ok: false as const,
        message: `${file.name} exceeds ${formatUploadLimitLabel(maxBytes)} limit.`,
      };
    }
  }

  const batchId = newUploadBatchId();
  const validationIds: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const validationId = crypto.randomUUID();
    const storagePath = await storeIntakeFile({
      batchId,
      validationId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    const doc = await createDocumentValidation({
      id: validationId,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      upload_batch_id: batchId,
      manufacturer: manufacturerHint ?? guessManufacturerFromFileName(file.name),
      created_by: user.id,
    });
    validationIds.push(doc.id);
  }

  after(async () => {
    await processDocumentValidationBatch(validationIds);
    revalidateQaCenter();
  });

  revalidateQaCenter();
  return {
    ok: true as const,
    batchId,
    submitted: files.length,
    processed: 0,
    queued: validationIds.length,
  };
}

export { QA_KNOWLEDGE_CATEGORY_OPTIONS };
