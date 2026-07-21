import { describe, expect, it } from "vitest";
import { findUploadGateViolations } from "@/lib/time-clock/upload-gate";
import type { ResolvedUploadGate } from "@/lib/operating-models/types";
import type { WorkPackage } from "@/types/flow";

function task(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: "t1",
    title: "Toyota",
    status: "working_on_it",
    ...overrides,
  } as WorkPackage;
}

// Default gate for tests: on, no minutes threshold, so "any timer work" counts.
const alwaysGate = (): ResolvedUploadGate => ({ enabled: true, minTimedMinutes: 0 });

describe("findUploadGateViolations", () => {
  it("blocks when a files-required task got timer work but no uploads today", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { t1: 90 },
      tasks: [task({ files_required: true })],
      uploadsToday: [],
      resolveGate: alwaysGate,
    });
    expect(violations).toEqual([{ taskId: "t1", taskTitle: "Toyota" }]);
  });

  it("passes once the analyst uploaded at least one file today", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { t1: 90 },
      tasks: [task({ files_required: true })],
      uploadsToday: [{ task_id: "t1", user_id: "u1" }],
      resolveGate: alwaysGate,
    });
    expect(violations).toEqual([]);
  });

  it("someone else's upload does not count for this analyst", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { t1: 90 },
      tasks: [task({ files_required: true })],
      uploadsToday: [{ task_id: "t1", user_id: "u2" }],
      resolveGate: alwaysGate,
    });
    expect(violations).toHaveLength(1);
  });

  it("ignores tasks that do not require files", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { t1: 90 },
      tasks: [task({ files_required: false })],
      uploadsToday: [],
      resolveGate: alwaysGate,
    });
    expect(violations).toEqual([]);
  });

  it("ignores tasks with no timer work today and tasks already done", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { "t-done": 90 },
      tasks: [
        task({ id: "t-done", files_required: true, status: "done" }),
        task({ id: "t-untouched", files_required: true }),
      ],
      uploadsToday: [],
      resolveGate: alwaysGate,
    });
    expect(violations).toEqual([]);
  });

  it("does not block a task worked under the team's minutes threshold", () => {
    // Michael's case: opened Toyota and Subaru briefly, then went on break.
    const gate30 = (): ResolvedUploadGate => ({ enabled: true, minTimedMinutes: 30 });
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { t1: 4, t2: 120 },
      tasks: [
        task({ id: "t1", title: "Toyota", files_required: true }),
        task({ id: "t2", title: "Subaru", files_required: true }),
      ],
      uploadsToday: [],
      resolveGate: gate30,
    });
    // Only Subaru (worked well past 30 min) is a violation; Toyota's 4 min is skipped.
    expect(violations).toEqual([{ taskId: "t2", taskTitle: "Subaru" }]);
  });

  it("does not block at all when the team's gate is disabled", () => {
    const off = (): ResolvedUploadGate => ({ enabled: false, minTimedMinutes: 30 });
    const violations = findUploadGateViolations({
      userId: "u1",
      timedMinutesByTask: { t1: 300 },
      tasks: [task({ files_required: true })],
      uploadsToday: [],
      resolveGate: off,
    });
    expect(violations).toEqual([]);
  });
});
