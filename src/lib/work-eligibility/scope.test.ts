import { describe, expect, it, vi, afterEach } from "vitest";
import * as teamScope from "@/lib/auth/team-scope";
import { assertCanManageEmployeeEligibility } from "@/lib/work-eligibility/scope";
import type { User } from "@/types/flow";

function user(id: string): User {
  return {
    id,
    email: `${id}@test.com`,
    first_name: id,
    last_name: "User",
    full_name: id,
    role: "manager",
    is_active: true,
    team_id: null,
    manager_id: null,
    hire_date: null,
    created_at: "",
    updated_at: "",
  };
}

describe("work eligibility scope", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows managers in hierarchy scope", () => {
    vi.spyOn(teamScope, "teamLeadCanViewPerson").mockReturnValue(true);
    expect(() =>
      assertCanManageEmployeeEligibility(user("mgr"), "emp-1")
    ).not.toThrow();
  });

  it("blocks managers outside hierarchy scope", () => {
    vi.spyOn(teamScope, "teamLeadCanViewPerson").mockReturnValue(false);
    expect(() =>
      assertCanManageEmployeeEligibility(user("mgr"), "emp-1")
    ).toThrow("FORBIDDEN");
  });
});
