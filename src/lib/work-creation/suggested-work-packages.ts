import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import { PROJECT_TEMPLATES } from "@/lib/templates/project-templates";
import type { WorkStructureMode } from "@/lib/work-packages/smart-labels";
import { dedupeSortLabels } from "@/lib/work-creation/sort-labels";

/** Common OEM / work package names for manufacturer-style projects. */
export const COMMON_WORK_PACKAGE_NAMES = [
  "Acura",
  "Audi",
  "BMW",
  "Chevrolet",
  "Chrysler",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Kia",
  "Lexus",
  "Mazda",
  "Mercedes",
  "Nissan",
  "Ram",
  "Subaru",
  "Toyota",
  "Volkswagen",
];

export function getSuggestedWorkPackageNames(input: {
  templateId?: ProjectTemplateId | string;
  projectType?: string;
  structureMode?: WorkStructureMode;
}): string[] {
  const tpl = PROJECT_TEMPLATES.find((t) => t.id === input.templateId);
  if (tpl?.manufacturers?.length) return dedupeSortLabels([...tpl.manufacturers]);

  const manufacturerStyle =
    input.structureMode === "by_manufacturer" ||
    input.projectType === "si_corrections" ||
    input.projectType === "special_functions";

  if (manufacturerStyle) return [...COMMON_WORK_PACKAGE_NAMES];

  if (input.structureMode === "by_workstream") {
    return ["Documentation", "Validation", "Integration", "QA & Release"];
  }

  if (input.structureMode === "by_team") {
    return ["Team A", "Team B", "Team C"];
  }

  if (input.structureMode === "by_year_phase") {
    const y = new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1)];
  }

  return ["General"];
}

export function mergeWorkPackageOptions(
  suggested: string[],
  custom: string[],
  selectedFromDraft: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...suggested, ...custom, ...selectedFromDraft]) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return dedupeSortLabels(out, "alpha");
}
