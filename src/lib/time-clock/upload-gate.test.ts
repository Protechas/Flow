import { describe, expect, it } from "vitest";
import { findUploadGateViolations } from "@/lib/time-clock/upload-gate";
import type { WorkPackage } from "@/types/flow";

function task(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: "t1",
    title: "Toyota",
    status: "working_on_it",
    ...overrides,
  } as WorkPackage;
}

describe("findUploadGateViolations", () => {
  it("blocks when a files-required task got timer work but no uploads today", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedTaskIds: ["t1"],
      tasks: [task({ files_required: true })],
      uploadsToday: [],
    });
    expect(violations).toEqual([{ taskId: "t1", taskTitle: "Toyota" }]);
  });

  it("passes once the analyst uploaded at least one file today", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedTaskIds: ["t1"],
      tasks: [task({ files_required: true })],
      uploadsToday: [{ task_id: "t1", user_id: "u1" }],
    });
    expect(violations).toEqual([]);
  });

  it("someone else's upload does not count for this analyst", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedTaskIds: ["t1"],
      tasks: [task({ files_required: true })],
      uploadsToday: [{ task_id: "t1", user_id: "u2" }],
    });
    expect(violations).toHaveLength(1);
  });

  it("ignores tasks that do not require files", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedTaskIds: ["t1"],
      tasks: [task({ files_required: false })],
      uploadsToday: [],
    });
    expect(violations).toEqual([]);
  });

  it("ignores tasks with no timer work today and tasks already done", () => {
    const violations = findUploadGateViolations({
      userId: "u1",
      timedTaskIds: ["t-done"],
      tasks: [
        task({ id: "t-done", files_required: true, status: "done" }),
        task({ id: "t-untouched", files_required: true }),
      ],
      uploadsToday: [],
    });
    expect(violations).toEqual([]);
  });
});
