import { getEnterpriseTemplate } from "@/lib/templates/template-registry";
import {
  STANDARD_TASK_TEMPLATES,
  type ProjectCreationDraft,
  type TaskDraft,
  type WorkPackageDraft,
} from "@/lib/work-creation/project-structure-types";

/** Resolve tasks that will be created for a package (matches createProjectWithStructureAction). */
export function resolveTasksForPackage(
  pkg: WorkPackageDraft,
  draft: ProjectCreationDraft
): TaskDraft[] {
  if (pkg.taskSetupMode === "copy" && pkg.copyFromPackageId) {
    const source = draft.packages.find((p) => p.id === pkg.copyFromPackageId);
    if (source?.tasks.length) {
      return source.tasks.map((t) => ({ ...t, title: t.title }));
    }
  }
  if (pkg.taskSetupMode === "template") {
    if (draft.enterpriseTemplateId) {
      const ent = getEnterpriseTemplate(draft.enterpriseTemplateId);
      if (ent?.tasks.length) {
        return ent.tasks.map((t) => ({
          title: t.title,
          estimatedDocuments: t.estimated_document_count ?? null,
          priority: t.priority ?? draft.priority,
          qaRequired: t.requires_qa,
          filesRequired: t.requires_files,
          notes: t.description ?? null,
        }));
      }
    }
    const std = STANDARD_TASK_TEMPLATES[draft.projectType] ?? STANDARD_TASK_TEMPLATES.custom;
    return std.map((title) => ({
      title,
      priority: draft.priority,
      qaRequired: draft.tracking.qaRequired,
      filesRequired: draft.tracking.filesRequired,
    }));
  }
  return pkg.tasks;
}

/** Task count after create — one task batch per named package (first phase year only). */
export function countResolvedTasksForDraft(draft: ProjectCreationDraft): number {
  const named = draft.packages.filter((p) => p.name.trim());
  const packages = named.length ? named : draft.packages;
  return packages.reduce((sum, pkg) => sum + resolveTasksForPackage(pkg, draft).length, 0);
}

export function resolvedTasksForPackage(pkg: WorkPackageDraft, draft: ProjectCreationDraft): TaskDraft[] {
  if (!pkg.name.trim() && draft.packages.filter((p) => p.name.trim()).length > 0) {
    return [];
  }
  return resolveTasksForPackage(pkg, draft);
}
