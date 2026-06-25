import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import { PROJECT_TEMPLATES } from "@/lib/templates/project-templates";

export type BoardTemplateId =
  | "adas_task_board"
  | "qa_review_board"
  | "training_board"
  | "si_library_board"
  | "custom_board";

export interface BoardTemplate {
  id: BoardTemplateId;
  label: string;
  description: string;
  purpose: string;
  projectType: "board";
  defaultWorkstream?: string;
  defaultQaRequired?: boolean;
  defaultFilesRequired?: boolean;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "adas_task_board",
    label: "ADAS Task Board",
    description: "ADAS documentation and validation work queue",
    purpose: "Track ADAS program tasks across manufacturers and model years.",
    projectType: "board",
    defaultWorkstream: "ADAS Queue",
    defaultQaRequired: true,
    defaultFilesRequired: true,
  },
  {
    id: "qa_review_board",
    label: "QA Review Board",
    description: "QA review and correction workflow",
    purpose: "Centralize packages ready for QA, corrections, and re-review.",
    projectType: "board",
    defaultWorkstream: "QA Queue",
    defaultQaRequired: true,
    defaultFilesRequired: false,
  },
  {
    id: "training_board",
    label: "Training Board",
    description: "Onboarding and training assignments",
    purpose: "Assign training tasks and monitor completion for new analysts.",
    projectType: "board",
    defaultWorkstream: "Training",
    defaultQaRequired: false,
    defaultFilesRequired: false,
  },
  {
    id: "si_library_board",
    label: "SI Library Board",
    description: "Service information library operations",
    purpose: "Organize SI library audits and maintenance work.",
    projectType: "board",
    defaultWorkstream: "SI Library",
    defaultQaRequired: true,
    defaultFilesRequired: true,
  },
  {
    id: "custom_board",
    label: "Custom Board",
    description: "Blank operations board",
    purpose: "General-purpose team work queue.",
    projectType: "board",
    defaultWorkstream: "General",
    defaultQaRequired: true,
    defaultFilesRequired: false,
  },
];

/** User-facing project templates (maps to existing PROJECT_TEMPLATES ids). */
export const PROJECT_WIZARD_TEMPLATES: {
  id: ProjectTemplateId;
  label: string;
  description: string;
  highlights: string[];
}[] = [
  {
    id: "si_corrections",
    label: "SI Library Audit Project",
    description: "Correction backlog with QA workflow",
    highlights: ["SI corrections status", "QA pipeline", "Reporting enabled"],
  },
  {
    id: "adas_2026",
    label: "ADAS Program",
    description: "ADAS documentation program",
    highlights: ["ADAS project type", "Forecast shell", "QA pipeline"],
  },
  {
    id: "sf_phase_1",
    label: "Special Functions Phase 1",
    description: "Multi-OEM year matrix pre-built",
    highlights: ["7 manufacturers", "Years 2017–2026", "Full ops structure"],
  },
  {
    id: "research",
    label: "Admin Project",
    description: "Administrative or research initiative",
    highlights: ["Flexible structure", "Forecast optional", "Reporting enabled"],
  },
  {
    id: "custom",
    label: "Custom Blank Project",
    description: "Start from scratch",
    highlights: ["Manual structure", "You add manufacturers & tasks"],
  },
];

export function getProjectTemplate(id: string) {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

export function getBoardTemplate(id: string) {
  return BOARD_TEMPLATES.find((t) => t.id === id) ?? BOARD_TEMPLATES.find((t) => t.id === "custom_board")!;
}
