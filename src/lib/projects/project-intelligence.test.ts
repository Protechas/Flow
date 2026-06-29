import { describe, expect, it } from "vitest";
import {
  buildDepartmentIntelligence,
  buildProgramIntelligence,
} from "@/lib/projects/project-intelligence";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type { Department, ForecastSettings } from "@/types/flow";

const forecastSettings: ForecastSettings = {
  id: "default",
  minutes_per_document: 15,
  productive_day_percent: 81.25,
  productive_hours_per_day: 6.5,
  working_days: [1, 2, 3, 4, 5],
  updated_at: "",
};

function project(overrides: Partial<ProjectWithStats> = {}): ProjectWithStats {
  return {
    id: "p1",
    name: "Program A",
    project_type: "custom",
    status: "active",
    priority: "medium",
    department_id: "d1",
    manufacturerCount: 1,
    yearCount: 1,
    completedPct: 50,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("buildProgramIntelligence", () => {
  it("includes health breakdown factors", () => {
    const intel = buildProgramIntelligence(
      project({ project_due_date_status: "at_risk" }),
      [],
      [],
      [],
      [],
      [],
      forecastSettings
    );
    expect(intel.healthBreakdown.some((f) => f.id === "forecast")).toBe(true);
    expect(intel.healthScore).toBeLessThan(100);
  });
});

describe("buildDepartmentIntelligence", () => {
  it("rolls up programs by department", () => {
    const projects = [
      project({ id: "p1", department_id: "d1", name: "A" }),
      project({ id: "p2", department_id: "d1", name: "B" }),
      project({ id: "p3", department_id: "d2", name: "C" }),
    ];
    const departments: Department[] = [
      { id: "d1", name: "Engineering", created_at: "", updated_at: "" },
      { id: "d2", name: "QA", created_at: "", updated_at: "" },
    ];
    const intel = projects.map((p) =>
      buildProgramIntelligence(p, [], [], [], [], [], forecastSettings)
    );

    const breakdown = buildDepartmentIntelligence(projects, departments, intel);
    expect(breakdown).toHaveLength(2);
    const engineering = breakdown.find((d) => d.departmentId === "d1");
    expect(engineering?.projectCount).toBe(2);
    expect(engineering?.departmentName).toBe("Engineering");
  });
});
