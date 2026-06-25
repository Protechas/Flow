"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { persistNewProject } from "@/lib/data/projects-db";
import { persistWorkStructureForProject } from "@/lib/data/work-items-db";
import { createProjectFromEnterpriseTemplate } from "@/lib/templates/generate-from-template";
import type { CreateProjectFromTemplateInput, SaveCustomTemplateInput } from "@/lib/templates/enterprise-types";
import {
  archiveEnterpriseTemplate,
  duplicateEnterpriseTemplate,
  saveCustomEnterpriseTemplate,
} from "@/lib/templates/template-registry";

import { revalidateWorkSurfaces } from "@/lib/data/revalidate-work";

function revalidateTemplatePaths(projectId?: string) {
  revalidatePath("/operations/templates");
  revalidateWorkSurfaces(projectId);
}

export async function createProjectFromTemplateAction(input: CreateProjectFromTemplateInput) {
  const user = await requirePermission("projects:create");
  const ownerId =
    input.ownerId && input.ownerId !== "__none__"
      ? input.ownerId
      : normalizeRole(user.role) === "teamlead"
        ? user.id
        : null;

  try {
    const project = createProjectFromEnterpriseTemplate(
      {
        ...input,
        boardProjectId: input.boardProjectId === "__none__" ? null : input.boardProjectId,
      },
      ownerId
    );
    await persistNewProject({ ...project, created_by: user.id });
    await persistWorkStructureForProject(project.id);
    await writeAuditLog({
      action: "project_changed",
      entityType: "project",
      entityId: project.id,
      summary: `Created project from template: ${project.name}`,
      metadata: { templateId: input.templateId },
    });
    revalidateTemplatePaths(project.id);
    return { ok: true as const, projectId: project.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CREATE_FAILED";
    return { ok: false as const, error: msg };
  }
}

export async function saveCustomTemplateAction(input: SaveCustomTemplateInput) {
  const user = await requireUser();
  const role = normalizeRole(user.role);
  if (!["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(role)) {
    throw new Error("FORBIDDEN");
  }
  const template = saveCustomEnterpriseTemplate(input, user.id);
  revalidateTemplatePaths();
  return template;
}

export async function duplicateTemplateAction(templateId: string) {
  const user = await requireUser();
  const role = normalizeRole(user.role);
  if (!["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(role)) {
    throw new Error("FORBIDDEN");
  }
  const copy = duplicateEnterpriseTemplate(templateId, user.id);
  if (!copy) return { ok: false as const, error: "Template not found" };
  revalidateTemplatePaths();
  return { ok: true as const, templateId: copy.id };
}

export async function archiveTemplateAction(templateId: string) {
  await requirePermission("settings:manage");
  const ok = archiveEnterpriseTemplate(templateId);
  revalidateTemplatePaths();
  return { ok };
}

export async function createProjectFromTemplateAndRedirectAction(
  input: CreateProjectFromTemplateInput
) {
  const result = await createProjectFromTemplateAction(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(`/projects/${result.projectId}`);
}
