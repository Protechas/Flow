"use server";

import { revalidatePath } from "next/cache";
import { getEffectivePermissionRole, getSystemAccessLevel } from "@/lib/auth/access-level";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createFlowNativeDocument,
  deleteCompanyDocument,
  getCompanyDocumentById,
  getCompanyDocumentContent,
  listCompanyDocuments,
  saveCompanyDocumentContent,
  updateCompanyDocumentMeta,
  uploadCompanyDocument,
} from "@/lib/files/company-documents";
import {
  acknowledgeRevision,
  listPendingRevisionsForUser,
  publishDocumentRevision,
  requiresSopAcknowledgment,
} from "@/lib/files/document-revisions";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  listDocumentFolders,
  renameDocumentFolder,
} from "@/lib/files/document-folders";
import { inferDocumentMime } from "@/lib/files/mime";
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

/**
 * Protected documents steer Eddy's QA judgment — editing one is
 * reprogramming the AI's standards. Admin hands only.
 */
async function protectedDocGuard(
  documentId: string,
  user: Awaited<ReturnType<typeof requireUser>>
): Promise<string | null> {
  const doc = await getCompanyDocumentById(documentId);
  if (!doc) return "Document not found";
  if (!doc.is_protected) return null;
  const level = getSystemAccessLevel(user);
  if (level === "admin" || level === "super_admin") return null;
  return "This document is protected — it guides Eddy's QA reviews, so only admins can change it.";
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
      // Browsers often report Office files with an empty type — the bucket
      // allowlist then rejected octet-stream. The extension knows better.
      mime_type: inferDocumentMime(file.name, file.type),
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

/** Create a document authored in Flow (no file upload) and hand back its id for the editor. */
export async function createBlankDocumentAction(input: {
  title: string;
  description?: string;
  category: CompanyDocumentCategory;
  folder_id?: string | null;
  tags?: string[];
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to create documents" };
  }

  const title = input.title.trim();
  if (!title) return { ok: false as const, message: "Title is required" };
  if (!VALID_CATEGORIES.has(input.category)) {
    return { ok: false as const, message: "Invalid document category" };
  }

  try {
    const doc = await createFlowNativeDocument({
      title,
      description: input.description,
      category: input.category,
      folder_id: input.folder_id ?? null,
      tags: input.tags,
      created_by: user.id,
    });
    revalidateFiles();
    return { ok: true as const, id: doc.id };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not create document",
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
  const blocked = await protectedDocGuard(documentId, user);
  if (blocked) return { ok: false as const, message: blocked };

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
  const blocked = await protectedDocGuard(documentId, user);
  if (blocked) return { ok: false as const, message: blocked };

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

// --- Revisions & acknowledgments ---------------------------------------------

/**
 * Publish the current in-Flow content as an official revision: snapshots it,
 * diffs against the prior revision, and notifies everyone who must accept it.
 */
export async function publishDocumentRevisionAction(
  documentId: string,
  changeSummary: string
) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to publish documents" };
  }
  const summary = changeSummary.trim();
  if (summary.length < 5) {
    return { ok: false as const, message: "Describe what changed — the team sees this summary" };
  }

  const doc = await getCompanyDocumentById(documentId);
  if (!doc) return { ok: false as const, message: "Document not found" };
  {
    const blocked = await protectedDocGuard(documentId, user);
    if (blocked) return { ok: false as const, message: blocked };
  }
  const content = await getCompanyDocumentContent(documentId);
  if (content == null) {
    return {
      ok: false as const,
      message: "Save the document in Flow first — publishing snapshots the Flow working copy",
    };
  }

  try {
    const { revision, notified } = await publishDocumentRevision({
      document: doc,
      contentHtml: content,
      changeSummary: summary,
      publishedBy: user.id,
    });
    revalidateFiles();
    return { ok: true as const, revisionNumber: revision.revision_number, notified };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Publish failed",
    };
  }
}

/** The gate calls this on mount/focus — cheap, usually empty. */
export async function getPendingAcknowledgmentsAction() {
  const user = await requireUser();
  if (!requiresSopAcknowledgment(user.role)) return [];
  return listPendingRevisionsForUser(user.id);
}

export async function acknowledgeRevisionAction(revisionId: string) {
  const user = await requireUser();
  try {
    await acknowledgeRevision(revisionId, user.id);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not record acknowledgment",
    };
  }
}

export async function saveDocumentContentAction(documentId: string, html: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "company_documents:manage")) {
    return { ok: false as const, message: "You do not have permission to edit documents" };
  }
  if (html.length > 2_000_000) {
    return { ok: false as const, message: "Document content is too large to save" };
  }
  const blocked = await protectedDocGuard(documentId, user);
  if (blocked) return { ok: false as const, message: blocked };

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
