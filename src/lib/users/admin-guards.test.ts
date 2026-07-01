import { describe, expect, it } from "vitest";
import { hasAdminAccess } from "@/lib/auth/access-level";
import {
  assertCanRemoveOrDeactivateUser,
  assertCanChangeUserAdminAccess,
  countActiveAdmins,
} from "@/lib/users/admin-guards";
import type { User } from "@/types/flow";

function admin(id: string): User {
  return {
    id,
    email: `${id}@test.com`,
    first_name: "Admin",
    last_name: id,
    full_name: `Admin ${id}`,
    role: "admin",
    system_access_level: "admin",
    organizational_position: "manager",
    is_active: true,
    team_id: null,
    manager_id: null,
    hire_date: null,
    created_at: "",
    updated_at: "",
  };
}

describe("admin guards", () => {
  it("blocks deleting or deactivating yourself", () => {
    const users = [admin("a1")];
    expect(() =>
      assertCanRemoveOrDeactivateUser("a1", users[0], users, "delete")
    ).toThrow(/your own account/);
    expect(() =>
      assertCanRemoveOrDeactivateUser("a1", users[0], users, "deactivate")
    ).toThrow(/your own account/);
  });

  it("blocks removing the last active administrator", () => {
    const users = [admin("a1"), { ...admin("e1"), role: "employee", system_access_level: "standard" }];
    expect(() =>
      assertCanRemoveOrDeactivateUser("e1", users[0], users, "delete")
    ).toThrow(/last administrator/);
  });

  it("allows removing a non-admin user", () => {
    const users = [admin("a1"), { ...admin("e1"), role: "employee", system_access_level: "standard" }];
    expect(() =>
      assertCanRemoveOrDeactivateUser("a1", users[1], users, "delete")
    ).not.toThrow();
  });

  it("counts active admins via hasAdminAccess", () => {
    const users = [
      admin("a1"),
      { ...admin("a2"), is_active: false },
      { ...admin("e1"), role: "employee", system_access_level: "standard" as const },
    ];
    expect(countActiveAdmins(users)).toBe(1);
    expect(hasAdminAccess(users[0])).toBe(true);
  });

  it("blocks demoting the last active administrator", () => {
    const users = [admin("a1"), { ...admin("e1"), role: "employee", system_access_level: "standard" }];
    expect(() =>
      assertCanChangeUserAdminAccess("e1", users[0], users, false)
    ).toThrow(/last administrator access/);
  });

  it("blocks removing your own administrator access", () => {
    const users = [admin("a1"), admin("a2")];
    expect(() =>
      assertCanChangeUserAdminAccess("a1", users[0], users, false)
    ).toThrow(/your own administrator access/);
  });
});
