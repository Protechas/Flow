import { describe, expect, it } from "vitest";
import { canAccessTeamDashboardPack } from "@/lib/team-dashboards/access";
import { ADVANCED_PROJECTS_PACK } from "@/lib/team-dashboards/advanced-projects";
import type { Team, User } from "@/types/flow";

const teams: Team[] = [
  {
    id: "team-advanced",
    name: "Advanced Projects Team",
    manager_id: "mgr-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const users: User[] = [
  {
    id: "mgr-1",
    email: "mgr@test.com",
    full_name: "Manager",
    role: "manager",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "member-1",
    email: "member@test.com",
    full_name: "Member",
    role: "employee",
    team_id: "team-advanced",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("team dashboard access", () => {
  it("allows managers with org visibility", () => {
    expect(canAccessTeamDashboardPack(users[0], ADVANCED_PROJECTS_PACK, teams, users)).toBe(true);
  });

  it("denies unrelated employees", () => {
    expect(
      canAccessTeamDashboardPack(
        { ...users[1], team_id: "other-team" },
        ADVANCED_PROJECTS_PACK,
        teams,
        users
      )
    ).toBe(false);
  });
});
