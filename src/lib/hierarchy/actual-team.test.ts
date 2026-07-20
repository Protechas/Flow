import { beforeEach, describe, expect, it } from "vitest";
import { getActualTeamMemberIds } from "./visibility-core";
import { getTeamUserIds } from "@/lib/operations/board-filters";
import { replaceOrgPositionStore } from "@/lib/positions/store";
import { replaceHierarchyStore } from "@/lib/hierarchy/store";
import type { OrgPosition, User } from "@/types/flow";

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

function makeSeat(overrides: Partial<OrgPosition> & { id: string }): OrgPosition {
  return {
    title: overrides.id,
    position_level: "employee",
    status: "filled",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Tara-shaped viewer: org-wide QA sight (admin access) but a real team of
// her own — the exact case where "my team" surfaces used to show everyone.
const tara = makeUser({
  id: "tara",
  role: "teamlead",
  system_access_level: "admin",
  organizational_position: "team_lead",
  team_id: "team-si",
  assigned_position_id: "seat-tara",
});

const users: User[] = [
  tara,
  makeUser({ id: "deryk", team_id: "team-si", assigned_position_id: "seat-deryk" }),
  makeUser({ id: "jacob", team_id: null, assigned_position_id: "seat-jacob" }),
  makeUser({ id: "michael", team_id: "team-si" }), // same team, seatless
  makeUser({ id: "outsider", team_id: "team-ap", assigned_position_id: "seat-outsider" }),
  makeUser({ id: "inactive", team_id: "team-si", is_active: false }),
];

const seats: OrgPosition[] = [
  makeSeat({
    id: "seat-tara",
    position_level: "team_lead",
    team_id: "team-si",
    assigned_user_id: "tara",
  }),
  makeSeat({ id: "seat-deryk", reports_to_position_id: "seat-tara", assigned_user_id: "deryk" }),
  // Seat with NO team_id — reports to Tara's seat; must still count as hers.
  makeSeat({ id: "seat-jacob", reports_to_position_id: "seat-tara", assigned_user_id: "jacob" }),
  makeSeat({ id: "seat-outsider", team_id: "team-ap", assigned_user_id: "outsider" }),
];

describe("getActualTeamMemberIds", () => {
  beforeEach(() => {
    replaceHierarchyStore([]);
    replaceOrgPositionStore(seats);
  });

  it("returns seat descendants + same-team members for an org-wide QA lead — not the whole company", () => {
    const ids = getActualTeamMemberIds(tara, users);
    expect(ids.sort()).toEqual(["deryk", "jacob", "michael", "tara"]);
    expect(ids).not.toContain("outsider");
    expect(ids).not.toContain("inactive");
  });

  it("always includes the viewer even with no team or reports", () => {
    const solo = makeUser({ id: "solo", role: "viewer" });
    replaceOrgPositionStore([]);
    expect(getActualTeamMemberIds(solo, [...users, solo])).toEqual(["solo"]);
  });
});

describe("getTeamUserIds (Operations 'My Team')", () => {
  beforeEach(() => {
    replaceHierarchyStore([]);
    replaceOrgPositionStore(seats);
  });

  it("scopes an org-wide QA lead to her actual team", () => {
    const analysts = users.filter((u) => u.role === "employee" && u.is_active);
    const ids = getTeamUserIds(tara, analysts, users, []);
    expect(ids.sort()).toEqual(["deryk", "jacob", "michael"]);
  });

  it("keeps company-wide fallback for viewers with no team of their own", () => {
    const noTeamAdmin = makeUser({
      id: "owner",
      role: "admin",
      system_access_level: "super_admin",
    });
    replaceOrgPositionStore([]);
    const analysts = users.filter((u) => u.role === "employee" && u.is_active);
    const ids = getTeamUserIds(noTeamAdmin, analysts, [...users, noTeamAdmin], []);
    // Falls through to the assignable pool (may be broader than one team).
    expect(ids).not.toContain("owner");
    expect(Array.isArray(ids)).toBe(true);
  });
});
