import { beforeEach, describe, expect, it } from "vitest";
import {
  ADVANCED_PROJECTS_MODEL,
  GENERAL_OPERATING_MODEL,
  SERVICE_INFORMATION_MODEL,
} from "@/lib/operating-models/presets";
import {
  buildOperatingContext,
  resolveOperatingModelForProject,
  resolveOperatingModelForTeam,
} from "@/lib/operating-models/resolve";
import { replaceOperatingModelsInStore } from "@/lib/operating-models/store";
import type { Project, Team } from "@/types/flow";

const teams: Team[] = [
  {
    id: "team-ap",
    name: "Advanced Projects Team",
    department_id: "dept-eng",
    manager_id: null,
    team_lead_id: null,
    is_active: true,
  },
];

beforeEach(() => {
  replaceOperatingModelsInStore([
    { ...GENERAL_OPERATING_MODEL, is_active: true, sort_order: 0 },
    { ...SERVICE_INFORMATION_MODEL, is_active: true, sort_order: 1 },
    {
      ...ADVANCED_PROJECTS_MODEL,
      teamId: "team-ap",
      departmentId: "dept-eng",
      is_active: true,
      sort_order: 2,
    },
  ]);
});

describe("resolveOperatingModelForTeam", () => {
  it("returns team-specific model when team is assigned", () => {
    const model = resolveOperatingModelForTeam("team-ap");
    expect(model.slug).toBe("advanced-projects");
  });

  it("falls back to general when no match", () => {
    const model = resolveOperatingModelForTeam("unknown");
    expect(model.slug).toBe("general-operations");
  });
});

describe("resolveOperatingModelForProject", () => {
  it("infers service information from project type", () => {
    const model = resolveOperatingModelForProject({
      project_type: "si_corrections",
      team_id: null,
      department_id: null,
    });
    expect(model.slug).toBe("service-information");
  });

  it("prefers team assignment over project type", () => {
    const model = resolveOperatingModelForProject(
      {
        project_type: "si_corrections",
        team_id: "team-ap",
        department_id: "dept-eng",
      },
      teams
    );
    expect(model.slug).toBe("advanced-projects");
  });
});

describe("buildOperatingContext", () => {
  it("returns department from team when provided", () => {
    const ctx = buildOperatingContext({ teamId: "team-ap", teams });
    expect(ctx.model.slug).toBe("advanced-projects");
    expect(ctx.departmentId).toBe("dept-eng");
  });
});
