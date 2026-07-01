import { describe, expect, it } from "vitest";
import {
  canViewProjectMetrics,
  canUpdateProjectMetricValues,
} from "@/lib/metrics/project-metrics-permissions";
import type { Project, User } from "@/types/flow";

const project: Project = {
  id: "proj-1",
  name: "Test",
  team_id: "team-1",
  project_owner_id: "owner-1",
  status: "active",
  created_at: "",
  updated_at: "",
};

const employee: User = {
  id: "emp-1",
  email: "e@test.com",
  first_name: "E",
  last_name: "E",
  full_name: "E E",
  role: "employee",
  team_id: "team-2",
  manager_id: null,
  is_active: true,
  hire_date: null,
  created_at: "",
  updated_at: "",
};

const manager: User = {
  ...employee,
  id: "mgr-1",
  role: "manager",
  organizational_position: "manager",
};

const owner: User = {
  ...employee,
  id: "owner-1",
  role: "teamlead",
  organizational_position: "team_lead",
  team_id: "team-1",
};

describe("project metrics permissions", () => {
  it("denies unrelated employees from viewing metrics", () => {
    expect(canViewProjectMetrics(employee, project)).toBe(false);
    expect(canUpdateProjectMetricValues(employee, project)).toBe(false);
  });

  it("allows managers and project owners", () => {
    expect(canViewProjectMetrics(manager, project)).toBe(true);
    expect(canViewProjectMetrics(owner, project)).toBe(true);
    expect(canUpdateProjectMetricValues(owner, project)).toBe(true);
  });
});
