import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import { PROJECT_TEMPLATES } from "@/lib/templates/project-templates";
import type { BulkMatrixOrder } from "@/lib/work-creation/bulk-matrix-types";
import { COMMON_MATRIX_YEARS } from "@/lib/work-creation/bulk-matrix-types";
import {
  defaultStructureModeForProjectType,
  type WorkStructureMode,
} from "@/lib/work-packages/smart-labels";

/** How the Program Builder creates the program backend. */
export type ProgramBlueprintKind = "structure" | "matrix";

export interface ProgramBlueprint {
  id: string;
  label: string;
  description: string;
  highlights: string[];
  kind: ProgramBlueprintKind;
  projectType: string;
  templateId: ProjectTemplateId;
  structureMode: WorkStructureMode;
  /** Pre-seed work package / manufacturer names (structure blueprints). */
  presetPackages?: string[];
  /** Pre-seed phase/year labels (structure blueprints). */
  presetPhases?: number[];
  /** Pre-seed OEM makes (matrix blueprints). */
  presetMakes?: string[];
  matrixOrder?: BulkMatrixOrder;
  defaultTaskSetup?: "manual" | "template";
}

const SF_MAKES = ["Toyota", "Honda", "Ford", "Nissan", "Chevrolet", "Mercedes", "BMW"];
const SF_YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i);

export const PROGRAM_BLUEPRINTS: ProgramBlueprint[] = [
  {
    id: "sf_phase_1",
    label: "Special Functions Phase 1",
    description: "Multi-OEM year matrix — Toyota through BMW, 2017–2026",
    highlights: ["7 OEMs", "Years 2017–2026", "SI reporting structure"],
    kind: "structure",
    projectType: "special_functions",
    templateId: "sf_phase_1",
    structureMode: "by_manufacturer",
    presetPackages: SF_MAKES,
    presetPhases: SF_YEARS,
    defaultTaskSetup: "template",
  },
  {
    id: "make_year_model_matrix",
    label: "Year / Make / Model Matrix",
    description: "Bulk-generate tasks across makes, years, and models",
    highlights: ["Matrix generator", "Configurable OEMs", "Task-per-cell"],
    kind: "matrix",
    projectType: "special_functions",
    templateId: "sf_phase_1",
    structureMode: "by_manufacturer",
    presetMakes: SF_MAKES,
    matrixOrder: "make_year_model",
  },
  {
    id: "si_corrections",
    label: "SI Library Audit",
    description: "Correction backlog with QA workflow",
    highlights: ["SI corrections", "QA pipeline", "Reporting enabled"],
    kind: "structure",
    projectType: "si_corrections",
    templateId: "si_corrections",
    structureMode: "by_manufacturer",
    presetPackages: ["General"],
    defaultTaskSetup: "template",
  },
  {
    id: "adas_program",
    label: "ADAS Program",
    description: "ADAS documentation program with workstreams and milestones",
    highlights: ["Workstream layout", "Forecast shell", "QA pipeline"],
    kind: "structure",
    projectType: "adas",
    templateId: "adas_2026",
    structureMode: "by_workstream",
    presetPackages: ["Primary Workstream"],
    defaultTaskSetup: "template",
  },
  {
    id: "admin_research",
    label: "Admin / Research",
    description: "Flexible administrative or research initiative",
    highlights: ["Light structure", "Forecast optional", "Reporting enabled"],
    kind: "structure",
    projectType: "research",
    templateId: "research",
    structureMode: "custom",
    presetPackages: ["General"],
    defaultTaskSetup: "manual",
  },
  {
    id: "custom_program",
    label: "Custom Program",
    description: "Start blank — name your own work packages and phases",
    highlights: ["Full control", "Any structure mode", "Add tasks after create"],
    kind: "structure",
    projectType: "custom",
    templateId: "custom",
    structureMode: "custom",
    defaultTaskSetup: "manual",
  },
];

export function getProgramBlueprint(id: string): ProgramBlueprint | undefined {
  return PROGRAM_BLUEPRINTS.find((b) => b.id === id);
}

export function getProgramBlueprintOrDefault(id?: string | null): ProgramBlueprint {
  return getProgramBlueprint(id ?? "") ?? PROGRAM_BLUEPRINTS.find((b) => b.id === "custom_program")!;
}

/** Resolve template metadata for a blueprint (manufacturers/years from legacy registry). */
export function blueprintTemplateMeta(blueprint: ProgramBlueprint) {
  return PROJECT_TEMPLATES.find((t) => t.id === blueprint.templateId);
}

export function defaultMatrixYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y + 1, ...COMMON_MATRIX_YEARS.filter((yr) => yr !== y && yr !== y + 1)].slice(0, 4);
}

export function structureModeForBlueprint(blueprint: ProgramBlueprint): WorkStructureMode {
  return blueprint.structureMode ?? defaultStructureModeForProjectType(blueprint.projectType);
}
