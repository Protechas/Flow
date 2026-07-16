import { describe, expect, it } from "vitest";
import { filterValidSupervisors, getValidSupervisorRoles } from "@/lib/setup/role-fields";
import type { User, UserRole } from "@/types/flow";

function user(id: string, role: UserRole, active = true): User {
  return {
    id,
    email: `${id}@flow.local`,
    first_name: id,
    last_name: "Test",
    full_name: `${id} Test`,
    role,
    is_active: active,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as User;
}

// Mirrors the real org: one manager, several admins, no senior managers or team leads.
const smallOrg = [
  user("dusty", "manager"),
  user("mark", "admin"),
  user("tara", "admin"),
  user("rai", "employee"),
  user("gone", "manager", false),
];

describe("getValidSupervisorRoles", () => {
  it("lets each role report to equal-or-higher rank", () => {
    expect(getValidSupervisorRoles("manager")).toContain("manager");
    expect(getValidSupervisorRoles("manager")).toContain("admin");
    expect(getValidSupervisorRoles("teamlead")).toContain("admin");
    expect(getValidSupervisorRoles("employee")).toContain("admin");
  });

  it("never lets anyone report to a lower rank", () => {
    expect(getValidSupervisorRoles("manager")).not.toContain("teamlead");
    expect(getValidSupervisorRoles("manager")).not.toContain("employee");
    expect(getValidSupervisorRoles("teamlead")).not.toContain("teamlead");
  });

  it("gives admins no supervisor requirement", () => {
    expect(getValidSupervisorRoles("admin")).toEqual([]);
    expect(getValidSupervisorRoles("super_admin")).toEqual([]);
  });
});

describe("filterValidSupervisors", () => {
  it("offers supervisors for a new manager in an org with no senior managers", () => {
    const names = filterValidSupervisors("manager", smallOrg).map((u) => u.id);
    expect(names).toEqual(["dusty", "mark", "tara"]);
  });

  it("excludes inactive users", () => {
    const names = filterValidSupervisors("manager", smallOrg).map((u) => u.id);
    expect(names).not.toContain("gone");
  });

  it("never offers someone as their own supervisor", () => {
    const names = filterValidSupervisors("manager", smallOrg, "dusty").map((u) => u.id);
    expect(names).toEqual(["mark", "tara"]);
  });
});
