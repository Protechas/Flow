"use server";

import { revalidatePath } from "next/cache";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { hasPermission } from "@/lib/auth/permissions";
import {
  deleteCompanyDocument,
  listCompanyDocuments,
  saveCompanyDocumentContent,
  updateCompanyDocumentMeta,
  uploadCompanyDocument,
} from "@/lib/files/company-documents";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  listDocumentFolders,
  renameDocumentFolder,
} from "@/lib/files/document-folders";
import { requireUser } from "@/lib/auth/session";
import type { CompanyDocumentCategory } from "@/types/flow";

const VALID_CATEGORIES = new Set<CompanyDocumentCategory>([
  "sop",
  "policy",
  "reference",
  "other",
]);

const FILES_PATHS = ["/files", "/work/files"];

function revalidateFiles() {
  for (const path of FILES_PATHS) revalidatePath(path);
}

export async function listCompanyDocumentsAction() {
  const user = await requireUser();
  if (!hasPermission(getEffectivePermissionRole(user), "company_documents:view")) {
    throw new Error("FORBIDDEN");
  }
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
  const folderId = String(formData.get("folder_id") ?? "").trim() || null;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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
      folder_id: folderId,
      tags,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size: buffer.length,
      buffer,
      uploaded_by: user.id,
    });
    revalidateFiles();
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

export async function updateCompanyDocumentMetaAction(
  documentId: string,
  patch: {
    title?: string;
    description?: string | null;
    category?: CompanyDocumentCategory;
    folder_id?: string | null;
    tags?: string[];
  }
) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to edit documents" };
  }
  if (patch.category !== undefined && !VALID_CATEGORIES.has(patch.category)) {
    return { ok: false as const, message: "Invalid document category" };
  }

  try {
    await updateCompanyDocumentMeta(documentId, patch);
    revalidateFiles();
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Update failed",
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
    revalidateFiles();
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

// --- Folders ---------------------------------------------------------------

export async function listDocumentFoldersAction() {
  const user = await requireUser();
  if (!hasPermission(getEffectivePermissionRole(user), "company_documents:view")) {
    throw new Error("FORBIDDEN");
  }
  return listDocumentFolders();
}

export async function createDocumentFolderAction(name: string, parentId: string | null) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to manage folders" };
  }
  try {
    const folder = await createDocumentFolder({
      name,
      parent_id: parentId,
      created_by: user.id,
    });
    revalidateFiles();
    return { ok: true as const, folder };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not create folder",
    };
  }
}

export async function renameDocumentFolderAction(folderId: string, name: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to manage folders" };
  }
  try {
    await renameDocumentFolder(folderId, name);
    revalidateFiles();
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not rename folder",
    };
  }
}

export async function deleteDocumentFolderAction(folderId: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to manage folders" };
  }
  try {
    await deleteDocumentFolder(folderId);
    revalidateFiles();
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not delete folder",
    };
  }
}

// --- In-Flow editing ---------------------------------------------------------

export async function saveDocumentContentAction(documentId: string, html: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to edit documents" };
  }
  if (html.length > 2_000_000) {
    return { ok: false as const, message: "Document content is too large to save" };
  }

  try {
    await saveCompanyDocumentContent(documentId, html, user.id);
    revalidateFiles();
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Save failed",
    };
  }
}
