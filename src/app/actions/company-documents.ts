"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/permissions";
import {
  deleteCompanyDocument,
  listCompanyDocuments,
  uploadCompanyDocument,
} from "@/lib/files/company-documents";
import { requireUser } from "@/lib/auth/session";
import type { CompanyDocumentCategory } from "@/types/flow";

const VALID_CATEGORIES = new Set<CompanyDocumentCategory>([
  "sop",
  "policy",
  "reference",
  "other",
]);

export async function listCompanyDocumentsAction() {
  await requireUser();
  return listCompanyDocuments();
}

export async function uploadCompanyDocumentAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to upload documents" };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "sop") as CompanyDocumentCategory;
  const file = formData.get("file") as File | null;

  if (!title) return { ok: false as const, message: "Title is required" };
  if (!file?.size) return { ok: false as const, message: "Choose a file to upload" };
  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false as const, message: "Invalid document category" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadCompanyDocument({
      title,
      description,
      category,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size: buffer.length,
      buffer,
      uploaded_by: user.id,
    });
    revalidatePath("/files");
    revalidatePath("/work/files");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

export async function deleteCompanyDocumentAction(documentId: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to delete documents" };
  }

  try {
    await deleteCompanyDocument(documentId);
    revalidatePath("/files");
    revalidatePath("/work/files");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Delete failed",
    };
  }
}
