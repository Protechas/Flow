export type ProjectTemplateId =
  | "sf_phase_1"
  | "adas_2026"
  | "si_corrections"
  | "research"
  | "custom";

export const PROJECT_TEMPLATES: {
  id: ProjectTemplateId;
  label: string;
  description: string;
  projectType: string;
  manufacturers?: string[];
  years?: number[];
}[] = [
  {
    id: "sf_phase_1",
    label: "Special Functions Phase 1",
    description: "Toyota through BMW, years 2017–2026 per manufacturer",
    projectType: "special_functions",
    manufacturers: ["Toyota", "Honda", "Ford", "Nissan", "Chevrolet", "Mercedes", "BMW"],
    years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  },
  {
    id: "adas_2026",
    label: "ADAS 2026",
    description: "ADAS program — add manufacturers after create",
    projectType: "adas",
  },
  {
    id: "si_corrections",
    label: "SI Corrections",
    description: "Correction backlog workflow",
    projectType: "si_corrections",
  },
  {
    id: "research",
    label: "Research",
    description: "Open research project",
    projectType: "research",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Blank project — configure manually",
    projectType: "custom",
  },
];

export const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => 2017 + i);
