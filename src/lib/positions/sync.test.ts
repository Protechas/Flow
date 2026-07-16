import { describe, expect, it } from "vitest";
import { deriveUserFieldsFromPosition } from "@/lib/positions/sync";
import type { OrgPosition, User } from "@/types/flow";

function pos(overrides: Partial<OrgPosition>): OrgPosition {
  return {
    id: "p",
    title: "Seat",
    position_level: "employee",
    status: "filled",
    assigned_user_id: null,
    reports_to_position_id: null,
    department_id: "dept-1",
    team_id: "team-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as OrgPosition;
}

const boss = { id: "u-boss", full_name: "Boss", is_active: true } as User;

describe("deriveUserFieldsFromPosition", () => {
  it("derives manager from the parent seat's assigned user", () => {
    const parent = pos({ id: "parent", position_level: "manager", assigned_user_id: "u-boss" });
    const seat = pos({ id: "seat", reports_to_position_id: "parent" });
    const derived = deriveUserFieldsFromPosition(seat, [parent, seat], [boss]);
    expect(derived.manager_id).toBe("u-boss");
    expect(derived.role).toBe("employee");
  });

  it("omits manager entirely when the parent seat is vacant — never wipes an existing supervisor", () => {
    const parent = pos({ id: "parent", position_level: "manager", assigned_user_id: null, status: "vacant" });
    const seat = pos({ id: "seat", reports_to_position_id: "parent" });
    const derived = deriveUserFieldsFromPosition(seat, [parent, seat], [boss]);
    expect("manager_id" in derived).toBe(false);
  });

  it("omits manager when the parent seat is missing from the active list (archived)", () => {
    const seat = pos({ id: "seat", reports_to_position_id: "archived-parent" });
    const derived = deriveUserFieldsFromPosition(seat, [seat], [boss]);
    expect("manager_id" in derived).toBe(false);
  });

  it("omits manager for true root seats", () => {
    const seat = pos({ id: "seat", position_level: "senior_manager", reports_to_position_id: null });
    const derived = deriveUserFieldsFromPosition(seat, [seat], [boss]);
    expect("manager_id" in derived).toBe(false);
    expect(derived.role).toBe("senior_manager");
  });
});
