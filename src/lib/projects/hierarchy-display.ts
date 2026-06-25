import type { SmartHierarchyLabels } from "@/lib/work-packages/smart-labels";
import { getHierarchyLabels } from "@/lib/projects/hierarchy-labels";

/** Compact rollup line for tree headers, e.g. "3 manufacturers · 5 years · 42 tasks". */
export function structureCountSummary(
  labels: SmartHierarchyLabels,
  counts: { workstreams: number; phases: number; tasks: number }
): string {
  return `${counts.workstreams} ${labels.workPackagePlural.toLowerCase()} · ${counts.phases} ${labels.phasePlural.toLowerCase()} · ${counts.tasks} ${labels.taskPlural.toLowerCase()}`;
}

export function structureSearchPlaceholder(projectType?: string | null): string {
  const labels = getHierarchyLabels(projectType);
  return `Search programs, ${labels.workPackagePlural.toLowerCase()}, ${labels.phasePlural.toLowerCase()}, ${labels.taskPlural.toLowerCase()}…`;
}

export function defaultStructureFilterLabel(): string {
  const labels = getHierarchyLabels();
  return `All ${labels.workPackagePlural.toLowerCase()}`;
}
