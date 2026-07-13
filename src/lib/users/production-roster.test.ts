import { describe, expect, it } from "vitest";
import { isProductionEmployee, isProductionRosterMember } from "@/lib/users/production-roster";
import { createDepartment, createTeam, getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { employeeUsers } from "@/lib/scoring/scorecard-periods";
import { createUserRecord } from "@/lib/data/users";

describe("production roster (team-aware)", () => {
  it("support-team members are employees but never rank in production metrics", async () => {
    initFlowStore();
    const store = getFlowStore();

    const siTeam = store.teams.find((t) => t.department_id);
    expect(siTeam).toBeDefined();

    const dept = createDepartment({ name: "Email Team Dept" });
    const supportTeam = createTeam({
      name: "Email Support",
      department_id: dept.id,
      is_production: false,
    });

    const analyst = await createUserRecord({
      id: "roster-analyst",
      email: "roster-analyst@flow.local",
      first_name: "Roster",
      last_name: "Analyst",
      full_name: "Roster Analyst",
      role: "employee",
      team_id: siTeam!.id,
      manager_id: null,
      hire_date: null,
      pay_type: "hourly",
      avatar_url: null,
      last_login_at: null,
      is_active: true,
    });
    const emailer = await createUserRecord({
      id: "roster-emailer",
      email: "roster-emailer@flow.local",
      first_name: "Michael",
      last_name: "Karl",
      full_name: "Michael Karl",
      role: "employee",
      team_id: supportTeam.id,
      manager_id: null,
      hire_date: null,
      pay_type: "salary",
      avatar_url: null,
      last_login_at: null,
      is_active: true,
    });

    // Both are real employees…
    expect(isProductionEmployee(analyst)).toBe(true);
    expect(isProductionEmployee(emailer)).toBe(true);

    // …but only the production-team member is on the metrics roster
    expect(isProductionRosterMember(analyst)).toBe(true);
    expect(isProductionRosterMember(emailer)).toBe(false);

    // And the performance engine's employee selection honors it
    const ranked = employeeUsers([analyst, emailer]);
    expect(ranked.map((u) => u.id)).toContain("roster-analyst");
    expect(ranked.map((u) => u.id)).not.toContain("roster-emailer");
  });
});
