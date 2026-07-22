import { afterEach, describe, expect, it } from "vitest";
import { isRankedForLeaderboards } from "./ranking";
import {
  removeOperatingModelFromStore,
  upsertOperatingModelInStore,
} from "@/lib/operating-models/store";
import type { TeamOperatingModelRecord } from "@/lib/operating-models/types";

function model(overrides: Partial<TeamOperatingModelRecord>): TeamOperatingModelRecord {
  return {
    slug: "test-excluded",
    label: "Test",
    description: "",
    hierarchyLabels: { workPackage: "WP", phase: "Phase" },
    structureMode: "custom",
    projectTypes: ["custom"],
    taskTypes: ["general"],
    trackingFields: ["hours"],
    kpis: [],
    is_active: true,
    ...overrides,
  };
}

afterEach(() => removeOperatingModelFromStore("test-excluded"));

describe("isRankedForLeaderboards", () => {
  it("excludes members of teams whose model opts out of rankings", () => {
    upsertOperatingModelInStore(model({ teamId: "team-x", excludeFromRankings: true }));
    expect(isRankedForLeaderboards({ team_id: "team-x" })).toBe(false);
  });

  it("ranks everyone else (no team, unbound team, opt-out absent)", () => {
    expect(isRankedForLeaderboards({ team_id: null })).toBe(true);
    expect(isRankedForLeaderboards({ team_id: "team-nobody-bound" })).toBe(true);
    upsertOperatingModelInStore(model({ teamId: "team-x", excludeFromRankings: false }));
    expect(isRankedForLeaderboards({ team_id: "team-x" })).toBe(true);
  });
});
