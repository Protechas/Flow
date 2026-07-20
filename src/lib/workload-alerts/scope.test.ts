import { describe, expect, it } from "vitest";
import { passesAlertScope } from "@/lib/workload-alerts/scope";

const openScope = { department_ids: [], team_ids: [], excluded_user_ids: [] };

describe("passesAlertScope", () => {
  it("passes everyone when no filters are set", () => {
    expect(
      passesAlertScope(openScope, { userId: "u1", departmentId: null, teamId: null })
    ).toBe(true);
  });

  it("blocks an excluded user even when dept and team match", () => {
    const settings = {
      department_ids: ["d1"],
      team_ids: ["t1"],
      excluded_user_ids: ["u1"],
    };
    expect(
      passesAlertScope(settings, { userId: "u1", departmentId: "d1", teamId: "t1" })
    ).toBe(false);
    expect(
      passesAlertScope(settings, { userId: "u2", departmentId: "d1", teamId: "t1" })
    ).toBe(true);
  });

  it("tolerates settings hydrated before the exclusions column existed", () => {
    const legacy = { department_ids: [], team_ids: [] } as unknown as Parameters<
      typeof passesAlertScope
    >[0];
    expect(
      passesAlertScope(legacy, { userId: "u1", departmentId: null, teamId: null })
    ).toBe(true);
  });

  it("enforces the department allowlist", () => {
    const settings = { ...openScope, department_ids: ["d1"] };
    expect(
      passesAlertScope(settings, { userId: "u1", departmentId: "d2", teamId: null })
    ).toBe(false);
    expect(
      passesAlertScope(settings, { userId: "u1", departmentId: null, teamId: null })
    ).toBe(false);
    expect(
      passesAlertScope(settings, { userId: "u1", departmentId: "d1", teamId: null })
    ).toBe(true);
  });

  it("enforces the team allowlist", () => {
    const settings = { ...openScope, team_ids: ["t1"] };
    expect(
      passesAlertScope(settings, { userId: "u1", departmentId: null, teamId: "t2" })
    ).toBe(false);
    expect(
      passesAlertScope(settings, { userId: "u1", departmentId: null, teamId: "t1" })
    ).toBe(true);
  });
});
