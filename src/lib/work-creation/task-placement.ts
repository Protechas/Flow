import { COMMON_WORK_PACKAGE_NAMES } from "@/lib/work-creation/suggested-work-packages";
import type { Manufacturer, Project, YearWorkItem } from "@/types/flow";

export interface TaskPlacement {
  workstream: string;
  year: number;
  source: "context" | "memory" | "title" | "project_default" | "fallback";
}

export interface TaskPlacementContext {
  project: Project | null;
  taskTitle: string;
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  /** When creating from a project row / ops tree */
  presetWorkstream?: string | null;
  presetYear?: number | null;
  memory?: TaskPlacement | null;
}

const MEMORY_KEY = "flow-task-placement-v1";

export function loadPlacementMemory(projectId: string): TaskPlacement | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = sessionStorage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { workstream: string; year: number }>;
    const entry = map[projectId];
    if (!entry?.workstream) return null;
    return {
      workstream: entry.workstream,
      year: entry.year,
      source: "memory",
    };
  } catch {
    return null;
  }
}

export function savePlacementMemory(projectId: string, workstream: string, year: number) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    const raw = sessionStorage.getItem(MEMORY_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { workstream: string; year: number }>) : {};
    map[projectId] = { workstream, year };
    sessionStorage.setItem(MEMORY_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function parseYearFromTitle(title: string): number | null {
  const match = title.match(/\b(20\d{2})\b/);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  return y >= 1990 && y <= 2100 ? y : null;
}

function parseMakeFromTitle(title: string): string | null {
  const lower = title.toLowerCase();
  for (const make of COMMON_WORK_PACKAGE_NAMES) {
    if (lower.includes(make.toLowerCase())) return make;
  }
  return null;
}

function projectDefaultWorkstream(project: Project | null): string {
  if (!project) return "General";
  switch (project.project_type) {
    case "si_corrections":
    case "special_functions":
      return "General";
    case "adas":
      return "ADAS Workstream";
    case "board":
      return "Inbox";
    default:
      return "General";
  }
}

export function inferTaskPlacement(ctx: TaskPlacementContext): TaskPlacement {
  if (ctx.presetWorkstream?.trim()) {
    return {
      workstream: ctx.presetWorkstream.trim(),
      year: ctx.presetYear ?? new Date().getFullYear(),
      source: "context",
    };
  }

  if (ctx.memory?.workstream) {
    return ctx.memory;
  }

  const titleYear = parseYearFromTitle(ctx.taskTitle);
  const titleMake = parseMakeFromTitle(ctx.taskTitle);

  if (titleMake || titleYear) {
    const projectMfrs = ctx.manufacturers.filter(
      (m) => m.project_id === ctx.project?.id && !m.is_archived
    );
    const matchedMfr = titleMake
      ? projectMfrs.find((m) => m.name.toLowerCase() === titleMake.toLowerCase())
      : undefined;
    return {
      workstream: matchedMfr?.name ?? titleMake ?? projectDefaultWorkstream(ctx.project),
      year: titleYear ?? new Date().getFullYear(),
      source: "title",
    };
  }

  const projectId = ctx.project?.id;
  if (projectId) {
    const projectMfrs = ctx.manufacturers
      .filter((m) => m.project_id === projectId && !m.is_archived)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (projectMfrs.length === 1) {
      const mfr = projectMfrs[0];
      const years = ctx.yearItems
        .filter((y) => y.manufacturer_id === mfr.id)
        .map((y) => y.year)
        .sort((a, b) => b - a);
      return {
        workstream: mfr.name,
        year: years[0] ?? new Date().getFullYear(),
        source: "project_default",
      };
    }
  }

  return {
    workstream: projectDefaultWorkstream(ctx.project),
    year: new Date().getFullYear(),
    source: "fallback",
  };
}

export function placementPreviewLine(
  labels: { workPackageShort: string; phaseShort: string; task: string },
  workstream: string,
  year: number,
  taskTitle: string
): string {
  const task = taskTitle.trim() || labels.task;
  return `${workstream} → ${year} → ${task}`;
}

export function workstreamsForProject(
  projectId: string | undefined,
  manufacturers: Manufacturer[]
): string[] {
  if (!projectId) return ["General"];
  const names = manufacturers
    .filter((m) => m.project_id === projectId && !m.is_archived)
    .map((m) => m.name);
  const set = new Set([...names, "General"]);
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function yearsForWorkstream(
  projectId: string | undefined,
  workstream: string,
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[]
): number[] {
  const current = new Date().getFullYear();
  if (!projectId) return [current, current + 1];

  const mfr = manufacturers.find(
    (m) =>
      m.project_id === projectId &&
      !m.is_archived &&
      m.name.toLowerCase() === workstream.toLowerCase()
  );

  const years = mfr
    ? yearItems.filter((y) => y.manufacturer_id === mfr.id).map((y) => y.year)
    : [];

  const set = new Set([current, current + 1, ...years]);
  return [...set].sort((a, b) => a - b);
}
