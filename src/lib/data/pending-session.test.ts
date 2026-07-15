import { describe, expect, it } from "vitest";
import { activeMinutesAfter } from "@/lib/data/production-tracking";
import type { TaskTimeEntry } from "@/types/flow";

function entry(overrides: Partial<TaskTimeEntry>): TaskTimeEntry {
  return {
    id: "tte-1",
    user_id: "u1",
    task_id: "t1",
    department_id: null,
    project_id: "p1",
    manufacturer_id: "m1",
    year_work_item_id: "y1",
    started_at: "2026-07-15T12:56:00.000Z",
    paused_at: null,
    resumed_at: null,
    completed_at: null,
    total_active_minutes: 0,
    pause_events: [],
    status: "active",
    is_correction_session: false,
    created_at: "2026-07-15T12:56:00.000Z",
    updated_at: "2026-07-15T12:56:00.000Z",
    ...overrides,
  };
}

const NOW = "2026-07-15T16:44:00.000Z";

describe("activeMinutesAfter — the Deryk bug", () => {
  it("a session spanning a batch submission keeps its post-submission slice", () => {
    // Session started 12:56; batch submitted 15:50; now 16:44 → 54 minutes
    // accrued since the batch. The old code returned 0 for this session.
    const mins = activeMinutesAfter(entry({}), "2026-07-15T15:50:00.000Z", NOW);
    expect(mins).toBe(54);
  });

  it("pauses after the boundary don't count", () => {
    const e = entry({
      status: "paused",
      paused_at: "2026-07-15T16:20:00.000Z",
      pause_events: [{ paused_at: "2026-07-15T16:20:00.000Z", resumed_at: null }],
    });
    // 15:50 → 16:20 active, then paused → 30 minutes.
    expect(activeMinutesAfter(e, "2026-07-15T15:50:00.000Z", NOW)).toBe(30);
  });

  it("a lunch pause inside the window is excluded", () => {
    const e = entry({
      pause_events: [
        { paused_at: "2026-07-15T17:06:00.000Z", resumed_at: "2026-07-15T17:28:00.000Z" },
      ],
    });
    // 16:44 → 18:29 window with 22 minutes of lunch inside → 83 minutes.
    expect(
      activeMinutesAfter(e, "2026-07-15T16:44:00.000Z", "2026-07-15T18:29:00.000Z")
    ).toBe(83);
  });

  it("sessions entirely before the boundary contribute nothing", () => {
    const e = entry({
      status: "completed",
      completed_at: "2026-07-15T14:00:00.000Z",
      total_active_minutes: 64,
    });
    expect(activeMinutesAfter(e, "2026-07-15T15:50:00.000Z", NOW)).toBe(0);
  });

  it("without a boundary, behaves like the plain total", () => {
    const e = entry({
      status: "completed",
      completed_at: "2026-07-15T14:00:00.000Z",
      total_active_minutes: 64,
    });
    expect(activeMinutesAfter(e, null, NOW)).toBe(64);
  });
});
