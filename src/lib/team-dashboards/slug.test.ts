import { describe, expect, it } from "vitest";
import { isValidTeamDashboardSlug, slugifyTeamDashboard } from "@/lib/team-dashboards/slug";

describe("team dashboard slug", () => {
  it("slugifies labels", () => {
    expect(slugifyTeamDashboard("Advanced Projects")).toBe("advanced-projects");
  });

  it("validates slugs", () => {
    expect(isValidTeamDashboardSlug("advanced-projects")).toBe(true);
    expect(isValidTeamDashboardSlug("Advanced")).toBe(false);
  });
});
