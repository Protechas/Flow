import type { WorkStructureMode } from "@/lib/work-packages/smart-labels";
import { getHierarchyLabels } from "@/lib/work-packages/smart-labels";
import type { ProjectCreationDraft } from "@/lib/work-creation/project-structure-types";
import { phaseLabelToYear } from "@/lib/work-creation/project-structure-types";
import {
  countResolvedTasksForDraft,
  resolvedTasksForPackage,
} from "@/lib/work-creation/resolve-package-tasks";

export interface StructurePreviewCounts {
  projects: number;
  workPackages: number;
  phases: number;
  tasks: number;
}

export interface StructurePreviewLine {
  label: string;
  value: string;
}

export interface StructurePreview {
  title: string;
  projectType?: string | null;
  structureMode?: WorkStructureMode | null;
  counts: StructurePreviewCounts;
  lines: StructurePreviewLine[];
  tree: string[];
  enabled: string[];
}

function countPhases(draft: ProjectCreationDraft): number {
  return draft.packages.reduce((sum, pkg) => {
    const phases = pkg.phases.length > 0 ? pkg.phases.length : 1;
    return sum + phases;
  }, 0);
}

function countTasks(draft: ProjectCreationDraft): number {
  return countResolvedTasksForDraft(draft);
}

export function buildStructurePreview(draft: ProjectCreationDraft): StructurePreview {
  const labels = getHierarchyLabels(draft.projectType, draft.structureMode);
  const packageCount = draft.packages.filter((p) => p.name.trim()).length || draft.packages.length;
  const phaseCount = countPhases(draft);
  const taskCount = countTasks(draft);

  const tree: string[] = [];
  const namedPackages = draft.packages.filter((p) => p.name.trim());
  for (const pkg of namedPackages.length ? namedPackages : draft.packages) {
    const pkgName = pkg.name.trim() || `New ${labels.workPackageShort}`;
    const phases = pkg.phases.length > 0 ? pkg.phases : [{ label: String(new Date().getFullYear()) }];
    const resolvedTasks = resolvedTasksForPackage(pkg, draft);
    if (resolvedTasks.length > 0) {
      const ph = phases[0];
      const year = phaseLabelToYear(ph.label, 0);
      for (const task of resolvedTasks) {
        tree.push(`${pkgName} → ${ph.label || year} → ${task.title.trim() || labels.task}`);
      }
    } else if (phases.length === 1) {
      tree.push(`${pkgName}`);
    } else {
      for (const ph of phases) {
        tree.push(`${pkgName} → ${ph.label || labels.phase}`);
      }
    }
  }

  const enabled: string[] = [
    "Project dashboard & reporting",
    "Forecast tracking",
    "Task timer connection",
  ];
  if (draft.tracking.qaRequired) enabled.push("QA pipeline");
  if (draft.tracking.filesRequired) enabled.push("File upload requirements");
  if (draft.tracking.dailyTracking) enabled.push("Daily progress tracking");
  if (draft.tracking.customMetrics.length) enabled.push("Custom metrics");
  if (Number(draft.tracking.estimatedDocuments) > 0) {
    enabled.push("Document volume forecasting");
  }

  return {
    title: draft.name.trim() || "New project",
    projectType: draft.projectType,
    structureMode: draft.structureMode,
    counts: {
      projects: 1,
      workPackages: packageCount,
      phases: phaseCount,
      tasks: taskCount,
    },
    lines: [
      { label: "Project", value: draft.name.trim() || "—" },
      { label: "Type", value: draft.projectType.replace(/_/g, " ") },
      { label: labels.workPackagePlural, value: String(packageCount) },
      { label: labels.phasePlural, value: String(phaseCount) },
      { label: labels.taskPlural, value: String(taskCount) },
      {
        label: "Est. documents",
        value:
          Number(draft.tracking.estimatedDocuments) > 0
            ? Number(draft.tracking.estimatedDocuments).toLocaleString()
            : "Not set",
      },
      {
        label: "Est. hours",
        value:
          Number(draft.tracking.estimatedHours) > 0
            ? draft.tracking.estimatedHours
            : "Not set",
      },
      { label: "QA", value: draft.tracking.qaRequired ? "Required" : "Optional" },
      { label: "Files", value: draft.tracking.filesRequired ? "Required" : "Optional" },
    ],
    tree: tree.slice(0, 24),
    enabled,
  };
}
