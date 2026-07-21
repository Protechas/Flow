import { describe, expect, it } from "vitest";
import { modelToDefinition } from "./persist-shape";
import { inputToModel, modelToFormInput, EMPTY_OPERATING_MODEL_INPUT } from "./form";
import type { TeamOperatingModelRecord } from "./types";

function record(): TeamOperatingModelRecord {
  return {
    ...inputToModel({
      ...EMPTY_OPERATING_MODEL_INPUT,
      slug: "advanced-projects",
      label: "Advanced Projects",
      teamId: "team-ap",
      contentChecksEnabled: false,
      uploadGateEnabled: false,
    }),
    wrapUpFields: [{ id: "next_action", label: "Next planned action" }],
    workspace: { showActiveProjectsPanel: true, overdueFirst: true },
    id: "row-1",
    is_active: true,
    sort_order: 3,
    updated_at: "2026-07-21T00:00:00Z",
    updated_by: "user-1",
  };
}

describe("modelToDefinition — persisted definition carries the whole model", () => {
  it("keeps content checks, upload gate, wrap-up fields, and workspace config", () => {
    const def = modelToDefinition(record());
    expect(def.contentChecksEnabled).toBe(false);
    expect(def.uploadGate).toEqual({ enabled: false, minTimedMinutes: 30 });
    expect(def.wrapUpFields).toEqual([{ id: "next_action", label: "Next planned action" }]);
    expect(def.workspace).toEqual({ showActiveProjectsPanel: true, overdueFirst: true });
  });

  it("keeps fields it has never heard of (future config survives saves)", () => {
    const def = modelToDefinition({ ...record(), futureField: "keep-me" } as TeamOperatingModelRecord);
    expect((def as Record<string, unknown>).futureField).toBe("keep-me");
  });

  it("strips record metadata and team/department bindings (those live in columns)", () => {
    const def = modelToDefinition(record());
    for (const key of ["id", "is_active", "sort_order", "updated_at", "updated_by", "teamId", "departmentId"]) {
      expect(def).not.toHaveProperty(key);
    }
  });
});

describe("settings-form save merge — unknown config survives a form round-trip", () => {
  it("preserves wrapUpFields/workspace when merged over the existing model", () => {
    const existing = record();
    // Mirrors saveOperatingModelAction: form input built from the model,
    // result spread over the existing record.
    const merged = { ...existing, ...inputToModel(modelToFormInput(existing)) };
    expect(merged.wrapUpFields).toEqual(existing.wrapUpFields);
    expect(merged.workspace).toEqual(existing.workspace);
    expect(merged.contentChecksEnabled).toBe(false);
    expect(merged.uploadGate).toEqual({ enabled: false, minTimedMinutes: 30 });
  });
});
