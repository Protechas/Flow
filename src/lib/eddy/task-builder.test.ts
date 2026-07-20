import { describe, expect, it } from "vitest";
import {
  catalogPromptBlock,
  describeTaskBuilderDraft,
  estimateMatrixRows,
  parseTaskBuilderTurn,
  validateTaskBuilderDraft,
  type BulkMatrixAiDraft,
  type TaskBuilderCatalog,
} from "./task-builder";

const catalog: TaskBuilderCatalog = {
  today: "2026-07-20",
  allowedModes: ["quick_task", "task_set", "bulk_matrix", "from_template"],
  projects: [
    { id: "proj-1", name: "Kia Special Functions", type: "special_functions", workstreams: ["Kia"] },
  ],
  analysts: [
    { id: "user-1", name: "Deleathia" },
    { id: "user-2", name: "Maxwell" },
  ],
  departments: [{ id: "dept-1", name: "Information Solutions" }],
  teams: [{ id: "team-1", name: "ID3 Team" }],
  templates: [
    { id: "tpl-1", label: "SI Corrections", description: "Standard corrections flow", taskCount: 4 },
  ],
  forecastUnits: ["files", "lines"],
};

describe("validateTaskBuilderDraft", () => {
  it("accepts a complete quick task", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "quick_task",
        projectId: "proj-1",
        title: "Name edits batch 3",
        assigneeId: "user-1",
        estimatedUnits: 40,
        forecastUnit: "lines",
        minutesPerUnit: 3,
        qaRequired: true,
      },
      catalog
    );
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.draft?.mode).toBe("quick_task");
  });

  it("rejects unknown project and assignee ids", () => {
    const res = validateTaskBuilderDraft(
      { mode: "quick_task", projectId: "nope", title: "X", assigneeId: "ghost" },
      catalog
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/Project id/);
    expect(res.errors.join(" ")).toMatch(/Assignee id/);
  });

  it("requires a project target", () => {
    const res = validateTaskBuilderDraft({ mode: "quick_task", title: "X" }, catalog);
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/existing project or name a new one/);
  });

  it("rejects modes the user lacks", () => {
    const res = validateTaskBuilderDraft(
      { mode: "bulk_matrix", name: "Z", departmentId: "dept-1", teamId: "team-1", makes: ["Kia"], years: [2026] },
      { ...catalog, allowedModes: ["quick_task"] }
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/permission/);
  });

  it("validates a task set and drops garbage entries", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "task_set",
        projectId: "proj-1",
        tasks: [
          { title: "Task A", assigneeId: "user-1" },
          { notitle: true },
          { title: "Task B", year: 2026 },
        ],
      },
      catalog
    );
    expect(res.ok).toBe(true);
    expect(res.draft && "tasks" in res.draft ? res.draft.tasks.length : 0).toBe(2);
  });

  it("caps oversized matrices", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "bulk_matrix",
        name: "Everything",
        departmentId: "dept-1",
        teamId: "team-1",
        makes: Array.from({ length: 20 }, (_, i) => `Make${i}`),
        years: [2020, 2021, 2022, 2023, 2024, 2025],
        modelCountPerGroup: 10,
      },
      catalog
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/limit is 600/);
  });

  it("accepts a template draft with valid ids", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "from_template",
        templateId: "tpl-1",
        name: "AP Corrections Q3",
        departmentId: "dept-1",
        teamId: "team-1",
      },
      catalog
    );
    expect(res.ok).toBe(true);
  });

  it("sanitizes out-of-range numbers instead of passing them through", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "quick_task",
        projectId: "proj-1",
        title: "X",
        estimatedUnits: -5,
        minutesPerUnit: 100000,
        year: 1200,
      },
      catalog
    );
    expect(res.ok).toBe(true);
    const d = res.draft;
    expect(d && "estimatedUnits" in d ? d.estimatedUnits : undefined).toBeNull();
    expect(d && "minutesPerUnit" in d ? d.minutesPerUnit : undefined).toBeNull();
    expect(d && "year" in d ? d.year : undefined).toBeNull();
  });
});

describe("estimateMatrixRows", () => {
  const base: BulkMatrixAiDraft = {
    mode: "bulk_matrix",
    name: "M",
    departmentId: "dept-1",
    teamId: "team-1",
    makes: ["Kia", "Hyundai"],
    years: [2025, 2026],
  };
  it("uses explicit models when present", () => {
    expect(estimateMatrixRows({ ...base, models: ["A", "B", "C"] })).toBe(12);
  });
  it("falls back to model count per group", () => {
    expect(estimateMatrixRows({ ...base, modelCountPerGroup: 5 })).toBe(20);
  });
  it("defaults to one model per group", () => {
    expect(estimateMatrixRows(base)).toBe(4);
  });
});

describe("parseTaskBuilderTurn", () => {
  it("extracts a fenced draft with summary", () => {
    const turn = parseTaskBuilderTurn(
      'Here you go\n```json\n{"summary":"One task","draft":{"mode":"quick_task","title":"X","projectId":"proj-1"}}\n```'
    );
    expect(turn.kind).toBe("draft");
    expect(turn.summary).toBe("One task");
    expect((turn.rawDraft as { mode: string }).mode).toBe("quick_task");
  });

  it("extracts a bare JSON draft", () => {
    const turn = parseTaskBuilderTurn(
      '{"draft":{"mode":"from_template","templateId":"tpl-1","name":"N","departmentId":"dept-1","teamId":"team-1"}}'
    );
    expect(turn.kind).toBe("draft");
  });

  it("treats plain text as a question", () => {
    const turn = parseTaskBuilderTurn("Which project should these land in?");
    expect(turn.kind).toBe("question");
    expect(turn.question).toMatch(/Which project/);
  });

  it("treats malformed JSON as a question", () => {
    const turn = parseTaskBuilderTurn('{"draft": {broken');
    expect(turn.kind).toBe("question");
  });
});

describe("describeTaskBuilderDraft", () => {
  it("summarizes a task set with assignees and units", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "task_set",
        projectId: "proj-1",
        forecastUnit: "lines",
        minutesPerUnit: 3,
        qaRequired: true,
        tasks: [
          { title: "Batch 1", assigneeId: "user-1", estimatedUnits: 40 },
          { title: "Batch 2", assigneeId: "user-2", estimatedUnits: 55 },
        ],
      },
      catalog
    );
    expect(res.ok).toBe(true);
    const lines = describeTaskBuilderDraft(res.draft!, catalog);
    expect(lines[0]).toMatch(/2 tasks in project "Kia Special Functions"/);
    expect(lines.join("\n")).toMatch(/Deleathia/);
    expect(lines.join("\n")).toMatch(/3 min\/line/);
  });

  it("summarizes a matrix with row estimate", () => {
    const res = validateTaskBuilderDraft(
      {
        mode: "bulk_matrix",
        name: "Kia 2027 SF",
        departmentId: "dept-1",
        teamId: "team-1",
        makes: ["Kia"],
        years: [2026, 2027],
        modelCountPerGroup: 3,
        docsPerTask: 10,
      },
      catalog
    );
    expect(res.ok).toBe(true);
    const lines = describeTaskBuilderDraft(res.draft!, catalog);
    expect(lines[0]).toMatch(/~6 generated tasks/);
  });
});

describe("catalogPromptBlock", () => {
  it("includes ids, names, and allowed modes", () => {
    const block = catalogPromptBlock(catalog);
    expect(block).toMatch(/proj-1 :: Kia Special Functions/);
    expect(block).toMatch(/user-1 :: Deleathia/);
    expect(block).toMatch(/quick_task, task_set, bulk_matrix, from_template/);
  });
});
