import { describe, expect, it } from "vitest";
import {
  buildDepartmentGroupedSections,
  buildOrgTree,
  type OrgChartDataBundle,
} from "@/lib/positions/org-tree";
import type { Department, OrgPosition, Team, User } from "@/types/flow";

function pos(overrides: Partial<OrgPosition>): OrgPosition {
  return {
    id: "p",
    title: "Seat",
    position_level: "employee",
    status: "vacant",
    assigned_user_id: null,
    reports_to_position_id: null,
    department_id: "dept-1",
    team_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as OrgPosition;
}

const department = { id: "dept-1", name: "Info Solutions", status: "active" } as Department;
const team = { id: "team-1", name: "ID3 Team", department_id: "dept-1" } as Team;

// The archived team-lead seat is NOT in the bundle (loadOrgChartBundle filters
// inactive seats) — the analyst under it is stranded.
function bundle(): OrgChartDataBundle {
  return {
    users: [
      { id: "u-emp", full_name: "Deleathia", is_active: true } as User,
    ],
    departments: [department],
    teams: [team],
    positions: [
      pos({ id: "senior", title: "Senior Manager", position_level: "senior_manager" }),
      pos({
        id: "mgr",
        title: "Team Manager",
        position_level: "manager",
        team_id: "team-1",
        reports_to_position_id: "senior",
        status: "filled",
      }),
      pos({
        id: "stranded-analyst",
        title: "Team Analyst",
        team_id: "team-1",
        reports_to_position_id: "archived-lead-not-in-bundle",
        status: "filled",
        assigned_user_id: "u-emp",
      }),
    ],
  };
}

describe("buildOrgTree", () => {
  it("treats a seat with an archived parent as a root instead of dropping it", () => {
    const tree = buildOrgTree(bundle());
    const rootIds = tree.roots.map((n) => n.position!.id);
    expect(rootIds).toContain("stranded-analyst");
  });
});

describe("buildDepartmentGroupedSections", () => {
  it("still renders a stranded seat under its team section", () => {
    const data = bundle();
    const tree = buildOrgTree(data);
    const sections = buildDepartmentGroupedSections(tree, data.departments, data.teams);

    const teamSection = sections[0]?.teams.find((t) => t.team.id === "team-1");
    expect(teamSection).toBeDefined();
    const ids = teamSection!.roots.map((n) => n.position!.id);
    expect(ids).toContain("mgr");
    expect(ids).toContain("stranded-analyst");
  });

  it("does not duplicate seats that already render inside a manager subtree", () => {
    const data = bundle();
    // Re-home the analyst under the manager — the normal, healthy shape
    data.positions = data.positions.map((p) =>
      p.id === "stranded-analyst" ? { ...p, reports_to_position_id: "mgr" } : p
    );
    const tree = buildOrgTree(data);
    const sections = buildDepartmentGroupedSections(tree, data.departments, data.teams);

    const teamSection = sections[0]?.teams.find((t) => t.team.id === "team-1");
    const rootIds = teamSection!.roots.map((n) => n.position!.id);
    expect(rootIds).toEqual(["mgr"]);
  });
});
