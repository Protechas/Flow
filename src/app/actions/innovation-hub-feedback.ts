"use server";

import { revalidatePath } from "next/cache";
import { getAppVersionInfo } from "@/lib/app/version";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  createFeedbackSubmission,
  listFeedbackSubmissions,
  updateFeedbackSubmission,
} from "@/lib/innovation-hub/feedback";
import {
  formatUploadLimitLabel,
  getFeedbackAttachmentMaxBytes,
} from "@/lib/files/upload-limits";
import type {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
} from "@/types/flow";

const VALID_CATEGORIES = new Set<FeedbackCategory>([
  "idea",
  "bug",
  "issue",
  "feature_request",
  "question",
]);

const VALID_PRIORITIES = new Set<FeedbackPriority>(["low", "medium", "high"]);

const VALID_STATUSES = new Set<FeedbackStatus>([
  "new",
  "investigating",
  "planned",
  "fixed",
  "rejected",
]);

export async function submitInnovationHubFeedbackAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user.role, "innovation_hub:submit")) {
    return { ok: false as const, message: "You do not have permission to submit feedback" };
  }

  const category = String(formData.get("category") ?? "") as FeedbackCategory;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium") as FeedbackPriority;
  const pageUrl = String(formData.get("page_url") ?? "").trim() || null;
  const deviceInfo = String(formData.get("device_info") ?? "").trim() || null;
  const file = formData.get("attachment") as File | null;

  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false as const, message: "Select a valid category" };
  }
  if (!title) return { ok: false as const, message: "Title is required" };
  if (!description) return { ok: false as const, message: "Description is required" };
  if (!VALID_PRIORITIES.has(priority)) {
    return { ok: false as const, message: "Select a valid priority" };
  }

  const appVersion = getAppVersionInfo().versionLabel;

  try {
    let attachment: { file_name: string; mime_type: string; buffer: Buffer } | undefined;
    if (file?.size) {
      const maxBytes = getFeedbackAttachmentMaxBytes();
      if (file.size > maxBytes) {
        return {
          ok: false as const,
          message: `Attachment must be ${formatUploadLimitLabel(maxBytes)} or smaller`,
        };
      }
      attachment = {
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        buffer: Buffer.from(await file.arrayBuffer()),
      };
    }

    await createFeedbackSubmission({
      user_id: user.id,
      user_name: user.full_name,
      user_email: user.email,
      category,
      title,
      description,
      priority,
      page_url: pageUrl,
      app_version: appVersion,
      device_info: deviceInfo,
      attachment,
    });

    revalidatePath("/innovation-hub");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not submit feedback",
    };
  }
}

export async function listInnovationHubFeedbackAction() {
  const user = await requireUser();
  if (!hasPermission(user.role, "innovation_hub:manage")) {
    return { ok: false as const, message: "You do not have permission to view feedback" };
  }

  try {
    const items = await listFeedbackSubmissions();
    return { ok: true as const, items };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not load feedback",
    };
  }
}

export async function updateInnovationHubFeedbackAction(input: {
  id: string;
  status?: FeedbackStatus;
  assigned_to?: string | null;
  resolution_notes?: string | null;
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "innovation_hub:manage")) {
    return { ok: false as const, message: "You do not have permission to update feedback" };
  }

  if (input.status && !VALID_STATUSES.has(input.status)) {
    return { ok: false as const, message: "Invalid status" };
  }

  try {
    await updateFeedbackSubmission(input.id, {
      status: input.status,
      assigned_to: input.assigned_to,
      resolution_notes: input.resolution_notes,
    });
    revalidatePath("/innovation-hub");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not update feedback",
    };
  }
}
