import { describe, expect, it } from "vitest";
import {
  mergeProjectDescription,
  parseWorkspaceConfig,
  stripWorkspaceConfig,
} from "@/lib/projects/workspace-config";
import type { ProjectWorkspaceConfig } from "@/lib/projects/workspace-types";

const config: ProjectWorkspaceConfig = {
  version: 1,
  templateId: "service-information",
  tracking: {
    qaRequired: true,
    fileUploads: true,
    dailyReports: true,
    forecasting: true,
    productionTracking: true,
    timeTracking: true,
    wrapUps: true,
    customMetrics: true,
  },
  columns: [],
};

describe("workspace config in project descriptions", () => {
  it("strip shows only the human text; edits round-trip without losing the config", () => {
    const stored = mergeProjectDescription("Wrap up the special functions", config);
    expect(stored).toContain("[[FLOW_WORKSPACE:v1]]");

    // What the user sees (health cards, edit dialog): no gibberish
    expect(stripWorkspaceConfig(stored)).toBe("Wrap up the special functions");

    // Simulate the edit flow: user types new text, config re-attached
    const afterEdit = mergeProjectDescription("New description", parseWorkspaceConfig(stored)!);
    expect(stripWorkspaceConfig(afterEdit)).toBe("New description");
    expect(parseWorkspaceConfig(afterEdit)?.templateId).toBe("service-information");

    // Even a raw blob pasted back in stays parseable, not doubled
    const stripped = stripWorkspaceConfig(afterEdit ?? "");
    expect(stripped.includes("[[FLOW_WORKSPACE")).toBe(false);
  });

  it("config-only descriptions strip to empty, not JSON", () => {
    const stored = mergeProjectDescription("", config);
    expect(stripWorkspaceConfig(stored)).toBe("");
  });
});
