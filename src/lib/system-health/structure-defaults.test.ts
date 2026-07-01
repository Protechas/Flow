import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isDemoStructureId,
  resolveProjectStructureDefaults,
} from "@/lib/departments/structure-defaults";
import {
  planClearInvalidManagerLinks,
  planClearMissingOrgParents,
} from "@/lib/system-health/repair-plans";
import type { Department, OrgPosition, Team, User } from "@/types/flow";

describe("structure defaults", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_FLOW_DEMO_MODE", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats demo ids as non-persisted structure refs", () => {
    expect(isDemoStructureId("team-1")).toBe(true);
    expect(isDemoStructureId("dept-service-info")).toBe(true);
    expect(
      isDemoStructureId("550e8400-e29b-41d4-a716-446655440000")
    ).toBe(false);
  });

  it("does not use demo team ids when Supabase is configured", () => {
    const departments: Department[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Ops",
        status: "active",
        created_at: "",
        updated_at: "",
      },
    ];
    const teams: Team[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "Team A",
        department_id: departments[0].id,
        created_at: "",
        updated_at: "",
      },
    ];

    const resolved = resolveProjectStructureDefaults({
      team_id: "team-1",
      department_id: "dept-service-info",
      departments,
      teams,
    });

    expect(resolved.team_id).toBe(teams[0].id);
    expect(resolved.department_id).toBe(departments[0].id);
  });
});

describe("system health repair plans", () => {
  it("plans org parent cleanup for missing parents", () => {
    const positions: OrgPosition[] = [
      {
        id: "pos-root",
        title: "Director",
        position_level: "senior_manager",
        status: "filled",
        reports_to_position_id: null,
        department_id: null,
        team_id: null,
        assigned_user_id: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: "pos-child",
        title: "Analyst",
        position_level: "employee",
        status: "vacant",
        reports_to_position_id: "pos-missing",
        department_id: null,
        team_id: null,
        assigned_user_id: null,
        created_at: "",
        updated_at: "",
      },
    ];

    const plan = planClearMissingOrgParents(positions);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.entityId).toBe("pos-child");
    expect(plan[0]?.nextValue).toBeNull();
  });

  it("plans manager link cleanup", () => {
    const users: User[] = [
      {
        id: "u1",
        email: "u1@test.com",
        first_name: "One",
        last_name: "User",
        full_name: "One User",
        role: "employee",
        manager_id: "missing-manager",
        is_active: true,
        team_id: null,
        hire_date: null,
        created_at: "",
        updated_at: "",
      },
    ];
    const plan = planClearInvalidManagerLinks(users, new Set(["u1"]));
    expect(plan).toHaveLength(1);
    expect(plan[0]?.entityId).toBe("u1");
  });
});
