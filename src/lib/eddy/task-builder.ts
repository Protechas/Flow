/**
 * Eddy Task Builder — conversational front-end to Flow's EXISTING creation
 * paths. Eddy interviews the user, classifies intent into one of the four
 * wizard shapes (quick task / task set / bulk matrix / enterprise template),
 * and emits a strict JSON draft. The draft is validated against a catalog of
 * real ids, previewed for the user, and only executed through the same server
 * actions the wizards call — Eddy never gets its own write path (AI security
 * rule #3: output is advisory until a human approves).
 *
 * Client-safe: pure types + validation + formatting. No server imports.
 */

import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";
import type { BulkMatrixOrder } from "@/lib/work-creation/bulk-matrix-types";

export type TaskBuilderMode =
  | "quick_task"
  | "task_set"
  | "bulk_matrix"
  | "from_template";

export interface TaskBuilderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Allowlisted context Eddy sees — ids and names only, never full records. */
export interface TaskBuilderCatalog {
  today: string;
  allowedModes: TaskBuilderMode[];
  projects: { id: string; name: string; type: string; workstreams: string[] }[];
  analysts: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  templates: { id: string; label: string; description: string; taskCount: number }[];
  forecastUnits: string[];
}

export interface QuickTaskItemDraft {
  title: string;
  workstream?: string | null;
  year?: number | null;
  assigneeId?: string | null;
  estimatedUnits?: number | null;
  dueDate?: string | null;
  notes?: string | null;
}

export interface QuickTaskDraft extends QuickTaskItemDraft {
  mode: "quick_task";
  projectId?: string | null;
  newProjectName?: string | null;
  forecastUnit?: string | null;
  minutesPerUnit?: number | null;
  complexity?: ForecastComplexityLevel | null;
  priority?: WorkPriority | null;
  qaRequired?: boolean | null;
  filesRequired?: boolean | null;
}

export interface TaskSetDraft {
  mode: "task_set";
  projectId?: string | null;
  newProjectName?: string | null;
  forecastUnit?: string | null;
  minutesPerUnit?: number | null;
  complexity?: ForecastComplexityLevel | null;
  priority?: WorkPriority | null;
  qaRequired?: boolean | null;
  filesRequired?: boolean | null;
  tasks: QuickTaskItemDraft[];
}

export interface BulkMatrixAiDraft {
  mode: "bulk_matrix";
  name: string;
  departmentId: string;
  teamId: string;
  projectType?: string | null;
  matrixOrder?: BulkMatrixOrder | null;
  makes: string[];
  years: number[];
  models?: string[] | null;
  modelCountPerGroup?: number | null;
  /** Count of units in EACH generated task (e.g. 500 lines per task). */
  docsPerTask?: number | null;
  /** What a unit is — files, lines, VINs… Drives per-task forecasting. */
  forecastUnit?: string | null;
  /** Minutes to complete one unit. */
  minutesPerUnit?: number | null;
  qaRequired?: boolean | null;
  filesRequired?: boolean | null;
  priority?: WorkPriority | null;
  complexity?: ForecastComplexityLevel | null;
  dueDate?: string | null;
  description?: string | null;
}

export interface FromTemplateDraft {
  mode: "from_template";
  templateId: string;
  name: string;
  departmentId: string;
  teamId: string;
  description?: string | null;
}

export type TaskBuilderDraft =
  | QuickTaskDraft
  | TaskSetDraft
  | BulkMatrixAiDraft
  | FromTemplateDraft;

/** One interview turn: either Eddy asks a question, or presents a draft. */
export interface TaskBuilderTurn {
  type: "question" | "draft";
  question?: string;
  draft?: TaskBuilderDraft;
  summary?: string;
}

export interface DraftValidation {
  ok: boolean;
  errors: string[];
  draft: TaskBuilderDraft | null;
}

export const TASK_BUILDER_MAX_TASKS = 30;
/** Total generated tasks (makes × years × models) — the real safety ceiling,
 * aligned with the app-wide 1000-row bulk limit. */
export const TASK_BUILDER_MAX_MATRIX_ROWS = 1000;
/** Per-dimension caps. Covers the full set of mainstream auto brands; the row
 * cap above is the true guardrail. */
export const TASK_BUILDER_MAX_MAKES = 40;
export const TASK_BUILDER_MAX_YEARS = 20;
export const TASK_BUILDER_MAX_MODELS = 40;
/** Messages (user + assistant) before the interview forces a fresh start.
 * Counts both sides, so this is ~20 back-and-forth exchanges — generous enough
 * that a normal build never hits it. */
export const TASK_BUILDER_MAX_TURNS = 40;

const PRIORITIES: WorkPriority[] = ["low", "medium", "high", "urgent"];
const COMPLEXITIES: ForecastComplexityLevel[] = [
  "simple",
  "standard",
  "complex",
  "very_complex",
];
const MATRIX_ORDERS: BulkMatrixOrder[] = [
  "make_year_model",
  "year_make_model",
  "make_year_task",
  "custom",
];

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanString(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s.slice(0, max) : null;
}

function cleanNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

function cleanYear(value: unknown): number | null {
  const n = cleanNumber(value, 1990, 2100);
  return n == null ? null : Math.floor(n);
}

function cleanEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function cleanBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function cleanItem(raw: Record<string, unknown>): QuickTaskItemDraft | null {
  const title = cleanString(raw.title, 200);
  if (!title) return null;
  return {
    title,
    workstream: cleanString(raw.workstream, 120),
    year: cleanYear(raw.year),
    assigneeId: cleanString(raw.assigneeId, 80),
    estimatedUnits: cleanNumber(raw.estimatedUnits, 0, 100000),
    dueDate: isIsoDate(raw.dueDate) ? raw.dueDate : null,
    notes: cleanString(raw.notes, 2000),
  };
}

function validateProjectTarget(
  draft: { projectId?: string | null; newProjectName?: string | null },
  catalog: TaskBuilderCatalog,
  errors: string[]
) {
  if (draft.projectId) {
    if (!catalog.projects.some((p) => p.id === draft.projectId)) {
      errors.push(`Project id "${draft.projectId}" doesn't exist.`);
    }
  } else if (!draft.newProjectName) {
    errors.push("Pick an existing project or name a new one.");
  }
}

function validateAssignee(
  assigneeId: string | null | undefined,
  catalog: TaskBuilderCatalog,
  errors: string[]
) {
  if (assigneeId && !catalog.analysts.some((a) => a.id === assigneeId)) {
    errors.push(`Assignee id "${assigneeId}" isn't an assignable analyst.`);
  }
}

/**
 * Estimated task rows a matrix draft will generate — mirrors the shape of
 * generateMatrixRows (makes × years × models-or-count) for capping and preview
 * without importing server-side generation.
 */
export function estimateMatrixRows(draft: BulkMatrixAiDraft): number {
  const models = draft.models?.length
    ? draft.models.length
    : Math.max(1, draft.modelCountPerGroup ?? 1);
  return draft.makes.length * draft.years.length * models;
}

/** Strict validation of a model-produced draft against real catalog ids. */
export function validateTaskBuilderDraft(
  raw: unknown,
  catalog: TaskBuilderCatalog
): DraftValidation {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Draft is not an object."], draft: null };
  }
  const d = raw as Record<string, unknown>;
  const mode = cleanEnum(d.mode, [
    "quick_task",
    "task_set",
    "bulk_matrix",
    "from_template",
  ] as const);
  if (!mode) {
    return { ok: false, errors: ["Draft has no valid mode."], draft: null };
  }
  if (!catalog.allowedModes.includes(mode)) {
    return {
      ok: false,
      errors: [`You don't have permission for ${mode.replace(/_/g, " ")} creation.`],
      draft: null,
    };
  }

  if (mode === "quick_task") {
    const item = cleanItem(d);
    if (!item) {
      return { ok: false, errors: ["Task needs a title."], draft: null };
    }
    const draft: QuickTaskDraft = {
      ...item,
      mode,
      projectId: cleanString(d.projectId, 80),
      newProjectName: cleanString(d.newProjectName, 160),
      forecastUnit: cleanString(d.forecastUnit, 40),
      minutesPerUnit: cleanNumber(d.minutesPerUnit, 0.1, 600),
      complexity: cleanEnum(d.complexity, COMPLEXITIES),
      priority: cleanEnum(d.priority, PRIORITIES),
      qaRequired: cleanBool(d.qaRequired),
      filesRequired: cleanBool(d.filesRequired),
    };
    validateProjectTarget(draft, catalog, errors);
    validateAssignee(draft.assigneeId, catalog, errors);
    return { ok: errors.length === 0, errors, draft };
  }

  if (mode === "task_set") {
    const rawTasks = Array.isArray(d.tasks) ? d.tasks : [];
    const tasks = rawTasks
      .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object")
      .map(cleanItem)
      .filter((t): t is QuickTaskItemDraft => t !== null);
    if (!tasks.length) errors.push("Task set has no valid tasks.");
    if (tasks.length > TASK_BUILDER_MAX_TASKS) {
      errors.push(
        `Task set has ${tasks.length} tasks — the limit is ${TASK_BUILDER_MAX_TASKS}. Use a bulk matrix project instead.`
      );
    }
    const draft: TaskSetDraft = {
      mode,
      projectId: cleanString(d.projectId, 80),
      newProjectName: cleanString(d.newProjectName, 160),
      forecastUnit: cleanString(d.forecastUnit, 40),
      minutesPerUnit: cleanNumber(d.minutesPerUnit, 0.1, 600),
      complexity: cleanEnum(d.complexity, COMPLEXITIES),
      priority: cleanEnum(d.priority, PRIORITIES),
      qaRequired: cleanBool(d.qaRequired),
      filesRequired: cleanBool(d.filesRequired),
      tasks,
    };
    validateProjectTarget(draft, catalog, errors);
    for (const t of tasks) validateAssignee(t.assigneeId, catalog, errors);
    return { ok: errors.length === 0, errors, draft };
  }

  if (mode === "bulk_matrix") {
    const name = cleanString(d.name, 160);
    const departmentId = cleanString(d.departmentId, 80);
    const teamId = cleanString(d.teamId, 80);
    const makes = Array.isArray(d.makes)
      ? d.makes.map((m) => cleanString(m, 60)).filter((m): m is string => m !== null)
      : [];
    const years = Array.isArray(d.years)
      ? d.years.map(cleanYear).filter((y): y is number => y !== null)
      : [];
    const models = Array.isArray(d.models)
      ? d.models.map((m) => cleanString(m, 80)).filter((m): m is string => m !== null)
      : null;
    if (!name) errors.push("Project name is required.");
    if (!departmentId || !catalog.departments.some((x) => x.id === departmentId)) {
      errors.push("A valid department is required.");
    }
    if (!teamId || !catalog.teams.some((x) => x.id === teamId)) {
      errors.push("A valid team is required.");
    }
    if (!makes.length) errors.push("At least one make is required.");
    if (makes.length > TASK_BUILDER_MAX_MAKES) {
      errors.push(`Too many makes (max ${TASK_BUILDER_MAX_MAKES}).`);
    }
    if (!years.length) errors.push("At least one year is required.");
    if (years.length > TASK_BUILDER_MAX_YEARS) {
      errors.push(`Too many years (max ${TASK_BUILDER_MAX_YEARS}).`);
    }
    if (models && models.length > TASK_BUILDER_MAX_MODELS) {
      errors.push(`Too many models (max ${TASK_BUILDER_MAX_MODELS}).`);
    }
    const draft: BulkMatrixAiDraft = {
      mode,
      name: name ?? "",
      departmentId: departmentId ?? "",
      teamId: teamId ?? "",
      projectType: cleanString(d.projectType, 60),
      matrixOrder: cleanEnum(d.matrixOrder, MATRIX_ORDERS),
      makes,
      years,
      models: models?.length ? models : null,
      modelCountPerGroup: cleanNumber(d.modelCountPerGroup, 1, 40),
      docsPerTask: cleanNumber(d.docsPerTask, 0, 100000),
      forecastUnit: cleanString(d.forecastUnit, 40),
      minutesPerUnit: cleanNumber(d.minutesPerUnit, 0.1, 600),
      qaRequired: cleanBool(d.qaRequired),
      filesRequired: cleanBool(d.filesRequired),
      priority: cleanEnum(d.priority, PRIORITIES),
      complexity: cleanEnum(d.complexity, COMPLEXITIES),
      dueDate: isIsoDate(d.dueDate) ? d.dueDate : null,
      description: cleanString(d.description, 500),
    };
    const rows = estimateMatrixRows(draft);
    if (rows > TASK_BUILDER_MAX_MATRIX_ROWS) {
      errors.push(
        `This matrix would generate ${rows} tasks — the limit is ${TASK_BUILDER_MAX_MATRIX_ROWS}. Split it into smaller projects.`
      );
    }
    return { ok: errors.length === 0, errors, draft };
  }

  // from_template
  const templateId = cleanString(d.templateId, 80);
  const name = cleanString(d.name, 160);
  const departmentId = cleanString(d.departmentId, 80);
  const teamId = cleanString(d.teamId, 80);
  if (!templateId || !catalog.templates.some((t) => t.id === templateId)) {
    errors.push("A valid template is required.");
  }
  if (!name) errors.push("Project name is required.");
  if (!departmentId || !catalog.departments.some((x) => x.id === departmentId)) {
    errors.push("A valid department is required.");
  }
  if (!teamId || !catalog.teams.some((x) => x.id === teamId)) {
    errors.push("A valid team is required.");
  }
  const draft: FromTemplateDraft = {
    mode,
    templateId: templateId ?? "",
    name: name ?? "",
    departmentId: departmentId ?? "",
    teamId: teamId ?? "",
    description: cleanString(d.description, 500),
  };
  return { ok: errors.length === 0, errors, draft };
}

function nameFor(id: string | null | undefined, list: { id: string; name: string }[]) {
  return list.find((x) => x.id === id)?.name ?? null;
}

/** Human-readable "will create" lines for the preview card. */
export function describeTaskBuilderDraft(
  draft: TaskBuilderDraft,
  catalog: TaskBuilderCatalog
): string[] {
  const lines: string[] = [];
  if (draft.mode === "quick_task" || draft.mode === "task_set") {
    const target = draft.projectId
      ? `project "${catalog.projects.find((p) => p.id === draft.projectId)?.name ?? draft.projectId}"`
      : `NEW project "${draft.newProjectName}"`;
    const items = draft.mode === "quick_task" ? [draft] : draft.tasks;
    lines.push(
      `${items.length} task${items.length === 1 ? "" : "s"} in ${target}`
    );
    for (const t of items.slice(0, 10)) {
      const assignee = nameFor(t.assigneeId, catalog.analysts);
      lines.push(
        `• ${t.title}${t.workstream ? ` · ${t.workstream}` : ""}${t.year ? ` ${t.year}` : ""}` +
          `${assignee ? ` → ${assignee}` : " → unassigned"}` +
          `${t.estimatedUnits ? ` · ${t.estimatedUnits} ${draft.forecastUnit ?? "units"}` : ""}` +
          `${t.dueDate ? ` · due ${t.dueDate}` : ""}`
      );
    }
    if (items.length > 10) lines.push(`…and ${items.length - 10} more`);
    const flags = [
      draft.minutesPerUnit
        ? `${draft.minutesPerUnit} min/${(draft.forecastUnit ?? "unit").replace(/s$/, "")}`
        : null,
      draft.qaRequired ? "QA required" : null,
      draft.filesRequired ? "Files required" : null,
      draft.priority && draft.priority !== "medium" ? `${draft.priority} priority` : null,
    ].filter(Boolean);
    if (flags.length) lines.push(flags.join(" · "));
    return lines;
  }
  if (draft.mode === "bulk_matrix") {
    const rows = estimateMatrixRows(draft);
    lines.push(`NEW bulk matrix project "${draft.name}" — ~${rows} generated tasks`);
    lines.push(
      `Makes: ${draft.makes.join(", ")} · Years: ${draft.years.join(", ")}` +
        (draft.models?.length ? ` · Models: ${draft.models.join(", ")}` : "")
    );
    const team = nameFor(draft.teamId, catalog.teams);
    if (team) lines.push(`Team: ${team}`);
    const unit = draft.forecastUnit ?? "files";
    const flags = [
      draft.docsPerTask ? `${draft.docsPerTask} ${unit}/task` : null,
      draft.minutesPerUnit
        ? `${draft.minutesPerUnit} min/${unit.replace(/s$/, "")}`
        : null,
      draft.qaRequired ? "QA required" : null,
      draft.filesRequired ? "Files required" : null,
    ].filter(Boolean);
    if (flags.length) lines.push(flags.join(" · "));
    return lines;
  }
  const tpl = catalog.templates.find((t) => t.id === draft.templateId);
  lines.push(
    `NEW project "${draft.name}" from template "${tpl?.label ?? draft.templateId}"` +
      (tpl ? ` (${tpl.taskCount} tasks)` : "")
  );
  const team = nameFor(draft.teamId, catalog.teams);
  if (team) lines.push(`Team: ${team}`);
  return lines;
}

/** Compact catalog block for the system prompt. */
export function catalogPromptBlock(catalog: TaskBuilderCatalog): string {
  const projects = catalog.projects
    .map(
      (p) =>
        `- ${p.id} :: ${p.name} (${p.type})` +
        (p.workstreams.length ? ` :: workstreams: ${p.workstreams.join(", ")}` : "")
    )
    .join("\n");
  const analysts = catalog.analysts.map((a) => `- ${a.id} :: ${a.name}`).join("\n");
  const departments = catalog.departments.map((x) => `- ${x.id} :: ${x.name}`).join("\n");
  const teams = catalog.teams.map((x) => `- ${x.id} :: ${x.name}`).join("\n");
  const templates = catalog.templates
    .map((t) => `- ${t.id} :: ${t.label} — ${t.description} (${t.taskCount} tasks)`)
    .join("\n");
  return [
    `Today: ${catalog.today}`,
    `Creation modes this user may use: ${catalog.allowedModes.join(", ")}`,
    `\nACTIVE PROJECTS (id :: name):\n${projects || "(none)"}`,
    `\nASSIGNABLE ANALYSTS (id :: name):\n${analysts || "(none)"}`,
    `\nDEPARTMENTS (id :: name):\n${departments || "(none)"}`,
    `\nTEAMS (id :: name):\n${teams || "(none)"}`,
    `\nENTERPRISE TEMPLATES (id :: label):\n${templates || "(none)"}`,
    `\nFORECAST UNITS SEEN IN USE: ${catalog.forecastUnits.join(", ") || "files"}`,
  ].join("\n");
}

/** Extract Eddy's turn from raw model text: a JSON draft or a plain question. */
export function parseTaskBuilderTurn(text: string): {
  kind: "question" | "draft";
  question: string;
  rawDraft: unknown;
  summary: string | null;
} {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
      if (parsed.draft && typeof parsed.draft === "object") {
        return {
          kind: "draft",
          question: "",
          rawDraft: parsed.draft,
          summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 600) : null,
        };
      }
    } catch {
      // fall through — treat as a question turn
    }
  }
  return {
    kind: "question",
    question: text.replace(/```json[\s\S]*?```/g, "").trim().slice(0, 1200),
    rawDraft: null,
    summary: null,
  };
}
