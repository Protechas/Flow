import { describe, expect, it } from "vitest";
import { ADVANCED_PROJECTS_PACK } from "@/lib/team-dashboards/advanced-projects";
import { resolveTeamForPack, scopeProjectsForPack } from "@/lib/team-dashboards/resolve";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type { Team } from "@/types/flow";

const teams: Team[] = [
  {
    id: "team-advanced",
    name: "Advanced Projects Team",
    department_id: "dept-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

function project(
  partial: Partial<ProjectWithStats> & Pick<ProjectWithStats, "id" | "name" | "project_type">
): ProjectWithStats {
  return {
    status: "active",
    department_id: "dept-1",
    team_id: null,
    manufacturerCount: 0,
    yearCount: 0,
    completedPct: 0,
    priority: "medium",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: "user-1",
    ...partial,
  } as ProjectWithStats;
}

describe("team dashboard resolve", () => {
  it("resolves team by name", () => {
    const team = resolveTeamForPack(ADVANCED_PROJECTS_PACK, teams);
    expect(team?.id).toBe("team-advanced");
  });

  it("scopes advanced projects by team and project type", () => {
    const team = resolveTeamForPack(ADVANCED_PROJECTS_PACK, teams);
    const scoped = scopeProjectsForPack(
      ADVANCED_PROJECTS_PACK,
      [
        project({ id: "p1", name: "ADAS", project_type: "adas" }),
        project({ id: "p2", name: "SF", project_type: "special_functions" }),
        project({
          id: "p3",
          name: "Custom",
          project_type: "custom",
          team_id: "team-advanced",
        }),
      ],
      team
    );

    expect(scoped.map((p) => p.id).sort()).toEqual(["p1", "p3"]);
  });
});
