import { beforeEach, describe, expect, it } from "vitest";
import {
  canViewProject,
  getVisibleProjectIds,
  getVisibleProjects,
  type ProjectScopeInput,
} from "./project-scope";
import { replaceHierarchyStore } from "@/lib/hierarchy/store";
import { replaceOrgPositionStore } from "@/lib/positions/store";
import type { Project, Team, User, WorkPackage } from "@/types/flow";

/**
 * PERSONA CONTRACT SUITE — a failing test here means a visibility leak (or a
 * lockout). Personas mirror the real org: Dusty (org-wide admin), Zach
 * (admin access kept org-wide), Chris (ID3 branch manager), Tara (SI team
 * lead, STANDARD access — the July 20 decision), employee.
 */

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    email: `${overrides.id}@test.local`,
    first_name: overrides.id,
    last_name: "Test",
    full_name: `${overrides.id} Test`,
    role: "employee",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> & { id: string }): Project {
  return {
    name: overrides.id,
    project_type: "custom",
    status: "active",
    priority: "medium",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTeam(id: string, name: string): Team {
  return {
    id,
    name,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeWp(
  id: string,
  projectId: string,
  assignedTo: string | null
): WorkPackage {
  return {
    id,
    project_id: projectId,
    manufacturer_id: "m1",
    year_work_item_id: "y1",
    year: 2026,
    title: id,
    status: "assigned",
    priority: "medium",
    estimated_hours: 1,
    actual_hours: 0,
    file_count: 0,
    qa_status: "none",
    correction_count: 0,
    assigned_to: assignedTo,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as WorkPackage;
}

const dusty = makeUser({
  id: "dusty",
  role: "admin",
  system_access_level: "admin",
  organizational_position: "manager",
});
const zach = makeUser({
  id: "zach",
  role: "manager",
  system_access_level: "admin",
  organizational_position: "manager",
  team_id: "team-ap",
});
const chris = makeUser({
  id: "chris",
  role: "manager",
  system_access_level: "standard",
  organizational_position: "manager",
  team_id: "team-id3",
  manager_id: "dusty",
});
const tara = makeUser({
  id: "tara",
  role: "teamlead",
  system_access_level: "standard",
  organizational_position: "team_lead",
  team_id: "team-si",
  manager_id: "dusty",
});
const deryk = makeUser({ id: "deryk", team_id: "team-si", manager_id: "tara" });
const coleen = makeUser({ id: "coleen", team_id: "team-id3", manager_id: "chris" });
const karl = makeUser({ id: "karl", team_id: "team-email", manager_id: "dusty" });

const users = [dusty, zach, chris, tara, deryk, coleen, karl];
const teams = [
  makeTeam("team-si", "Service Information Team"),
  makeTeam("team-id3", "ID3 Team"),
  makeTeam("team-ap", "Advanced Projects"),
  makeTeam("team-email", "Email Team"),
];

const projSi = makeProject({ id: "proj-si", team_id: "team-si" });
const projId3 = makeProject({ id: "proj-id3", team_id: "team-id3" });
const projAp = makeProject({ id: "proj-ap", team_id: "team-ap" });
// Same DEPARTMENT as SI but different team, nobody from SI involved — the
// old dept fallback used to leak this to SI viewers.
const projEmail = makeProject({
  id: "proj-email",
  team_id: "team-email",
  department_id: "dept-is",
});
// No team, created and owned by Chris.
const projChrisOwned = makeProject({
  id: "proj-chris",
  team_id: null,
  project_owner_id: "chris",
  created_by: "chris",
});
// Teamless project where an SI analyst is assigned work.
const projCross = makeProject({ id: "proj-cross", team_id: null });

const input: ProjectScopeInput = {
  projects: [projSi, projId3, projAp, projEmail, projChrisOwned, projCross],
  workPackages: [
    makeWp("wp1", "proj-si", "deryk"),
    makeWp("wp2", "proj-id3", "coleen"),
    makeWp("wp3", "proj-cross", "deryk"),
  ],
  users,
  teams,
};

function visibleTo(viewer: User): string[] {
  return [...getVisibleProjectIds(viewer, input)].sort();
}

beforeEach(() => {
  replaceHierarchyStore([]);
  replaceOrgPositionStore([]);
});

describe("project visibility contract", () => {
  it("Dusty (org-wide admin) sees everything", () => {
    expect(visibleTo(dusty)).toEqual(
      ["proj-ap", "proj-chris", "proj-cross", "proj-email", "proj-id3", "proj-si"].sort()
    );
  });

  it("Zach keeps org-wide access (admin access level)", () => {
    expect(visibleTo(zach)).toHaveLength(6);
  });

  it("Chris (ID3 branch manager) sees ID3 + his owned/created — nothing else", () => {
    expect(visibleTo(chris)).toEqual(["proj-chris", "proj-id3"]);
  });

  it("Tara (SI lead, STANDARD access) sees SI + branch-assignee projects only", () => {
    expect(visibleTo(tara)).toEqual(["proj-cross", "proj-si"]);
  });

  it("employee sees own team's projects + own assignments only", () => {
    expect(visibleTo(deryk)).toEqual(["proj-cross", "proj-si"]);
  });

  it("NO department fallback: same-dept project never leaks across teams", () => {
    for (const viewer of [chris, tara, deryk, coleen]) {
      expect(visibleTo(viewer)).not.toContain("proj-email");
    }
  });

  it("cross-team leak check: no branch viewer sees another branch's team projects", () => {
    expect(visibleTo(tara)).not.toContain("proj-id3");
    expect(visibleTo(chris)).not.toContain("proj-si");
    expect(visibleTo(coleen)).not.toContain("proj-si");
  });

  it("canViewProject and getVisibleProjects agree with the id set", () => {
    expect(canViewProject(tara, "proj-si", input)).toBe(true);
    expect(canViewProject(tara, "proj-id3", input)).toBe(false);
    expect(getVisibleProjects(chris, input).map((p) => p.id).sort()).toEqual(
      visibleTo(chris)
    );
  });
});
