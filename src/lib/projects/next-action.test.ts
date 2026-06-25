import { describe, expect, it } from "vitest";
import { getProjectNextAction, type ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type { Manufacturer, WorkPackage, YearWorkItem } from "@/types/flow";

function project(overrides: Partial<ProjectWithStats> = {}): ProjectWithStats {
  return {
    id: "p1",
    name: "ADAS Program",
    project_type: "custom",
    status: "active",
    priority: "medium",
    manufacturerCount: 0,
    yearCount: 0,
    completedPct: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("getProjectNextAction", () => {
  it("suggests first task for empty boards", () => {
    const action = getProjectNextAction(
      project({ project_type: "board" }),
      [],
      [],
      []
    );
    expect(action.label).toBe("Add first task");
    expect(action.openTaskComposer).toBe(true);
  });

  it("suggests workstream for empty programs", () => {
    const action = getProjectNextAction(project(), [], [], []);
    expect(action.label).toBe("Add workstream");
    expect(action.href).toContain("/projects/p1");
  });

  it("links assign tasks to operations by program", () => {
    const mfr: Manufacturer = {
      id: "m1",
      project_id: "p1",
      name: "Toyota",
      created_at: "",
      updated_at: "",
    };
    const year: YearWorkItem = {
      id: "y1",
      project_id: "p1",
      manufacturer_id: "m1",
      year: 2026,
      status: "not_started",
      created_at: "",
      updated_at: "",
    };
    const pkg: WorkPackage = {
      id: "wp1",
      project_id: "p1",
      manufacturer_id: "m1",
      year: 2026,
      year_work_item_id: "y1",
      title: "Task",
      status: "assigned",
      priority: "medium",
      qa_status: "not_submitted",
      created_at: "",
      updated_at: "",
    };

    const action = getProjectNextAction(project(), [mfr], [year], [pkg]);
    expect(action.label).toBe("Assign tasks");
    expect(action.href).toContain("projectId=p1");
    expect(action.href).toContain("grouping=by_program");
  });
});
