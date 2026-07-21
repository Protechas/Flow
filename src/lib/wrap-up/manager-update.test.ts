import { describe, expect, it } from "vitest";
import { canSubmitManagerUpdate, isFridayAppDate, weekOfFriday } from "./manager-update";
import type { TeamOperatingModel } from "@/lib/operating-models/types";

const FIELDS = [{ id: "contributions", label: "Manager contributions" }];

function model(overrides: Partial<TeamOperatingModel> = {}): TeamOperatingModel {
  return {
    slug: "advanced-projects",
    label: "Advanced Projects",
    description: "",
    hierarchyLabels: { workPackage: "Workstream", phase: "Milestone" },
    structureMode: "custom",
    projectTypes: ["development"],
    taskTypes: ["feature"],
    trackingFields: ["hours"],
    kpis: [],
    managerUpdate: { enabled: true, fields: FIELDS },
    ...overrides,
  };
}

describe("weekOfFriday", () => {
  it("maps every weekday to that week's Friday (Mon-based week)", () => {
    // 2026-07-20 is a Monday; Friday of that week is 2026-07-24.
    expect(weekOfFriday("2026-07-20")).toBe("2026-07-24");
    expect(weekOfFriday("2026-07-21")).toBe("2026-07-24");
    expect(weekOfFriday("2026-07-24")).toBe("2026-07-24");
    // Sunday belongs to the week that started the prior Monday.
    expect(weekOfFriday("2026-07-26")).toBe("2026-07-24");
    // Next Monday rolls to the next Friday.
    expect(weekOfFriday("2026-07-27")).toBe("2026-07-31");
  });
});

describe("isFridayAppDate", () => {
  it("detects Fridays", () => {
    expect(isFridayAppDate("2026-07-24")).toBe(true);
    expect(isFridayAppDate("2026-07-21")).toBe(false);
  });
});

describe("canSubmitManagerUpdate", () => {
  it("allows a manager-level user on a team with the config enabled", () => {
    expect(canSubmitManagerUpdate({ role: "admin", team_id: "team-ap" }, model())).toBe(true);
    expect(canSubmitManagerUpdate({ role: "manager", team_id: "team-ap" }, model())).toBe(true);
  });

  it("rejects employees, seatless users, disabled teams, and empty fields", () => {
    expect(canSubmitManagerUpdate({ role: "employee", team_id: "team-ap" }, model())).toBe(false);
    expect(canSubmitManagerUpdate({ role: "admin", team_id: null as unknown as string }, model())).toBe(false);
    expect(
      canSubmitManagerUpdate(
        { role: "admin", team_id: "team-ap" },
        model({ managerUpdate: { enabled: false, fields: FIELDS } })
      )
    ).toBe(false);
    expect(
      canSubmitManagerUpdate(
        { role: "admin", team_id: "team-ap" },
        model({ managerUpdate: { enabled: true, fields: [] } })
      )
    ).toBe(false);
    expect(canSubmitManagerUpdate({ role: "admin", team_id: "team-ap" }, model({ managerUpdate: undefined }))).toBe(false);
  });
});
