import type { EnterpriseProjectTemplate } from "@/lib/templates/enterprise-types";
import {
  emptyPackageDraft,
  emptyProjectCreationDraft,
  type ProjectCreationDraft,
} from "@/lib/work-creation/project-structure-types";
import { defaultStructureModeForProjectType } from "@/lib/work-packages/smart-labels";

/** Map an enterprise template into a Program Builder structure draft. */
export function structureDraftFromEnterpriseTemplate(
  template: EnterpriseProjectTemplate,
  base: Pick<ProjectCreationDraft, "departmentId" | "teamId" | "ownerId">
): ProjectCreationDraft {
  return {
    ...emptyProjectCreationDraft(),
    ...base,
    name: template.label,
    projectType: template.projectType,
    templateId: "custom",
    enterpriseTemplateId: template.id,
    structureMode: defaultStructureModeForProjectType(template.projectType),
    priority: template.defaultPriority,
    complexity: template.defaultComplexity,
    description: template.description,
    tracking: {
      estimatedDocuments: String(template.defaultEstimatedDocuments ?? ""),
      estimatedHours: String(
        template.tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0) || ""
      ),
      qaRequired: template.qaEnabled,
      filesRequired: template.fileUploadsRequired,
      dailyTracking: template.wrapUpsEnabled,
      customMetrics: [],
    },
    packages: [
      {
        ...emptyPackageDraft(),
        name: template.workflowManufacturerName,
        phases: [{ label: String(new Date().getFullYear()) }],
        taskSetupMode: "template",
      },
    ],
  };
}
