import { describe, expect, it } from "vitest";
import {
  clockIn,
  clockOut,
  endSideSession,
  getActiveSideSession,
  getActiveTaskTimeEntry,
  getSideSessionMinutesToday,
  startSideSession,
  startTaskTimer,
} from "@/lib/data/production-tracking";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";

describe("side sessions (meetings / training)", () => {
  it("pauses the task timer on start and resumes it on end", () => {
    initFlowStore();
    const uid = "test-emp-side-session";
    const task = getFlowStore().workPackages[0];
    expect(task).toBeDefined();

    clockIn(uid);
    startTaskTimer(uid, task.id);
    expect(getActiveTaskTimeEntry(uid)?.status).toBe("active");

    const session = startSideSession(uid, "meeting");
    expect(session.category).toBe("meeting");
    expect(session.paused_task_id).toBe(task.id);
    expect(getActiveTaskTimeEntry(uid)?.status).toBe("paused");
    expect(getActiveSideSession(uid)?.id).toBe(session.id);

    // Only one session at a time
    expect(() => startSideSession(uid, "training")).toThrow();

    const ended = endSideSession(uid);
    expect(ended.status).toBe("completed");
    expect(getActiveSideSession(uid)).toBeNull();
    // Back to normal: the timer the session paused is running again
    expect(getActiveTaskTimeEntry(uid)?.status).toBe("active");
    expect(getSideSessionMinutesToday(uid)).toBe(ended.minutes);
  });

  it("clock-out closes an open session so nothing runs unattended", () => {
    const uid = "test-emp-side-session-2";
    clockIn(uid);
    startSideSession(uid, "training");
    expect(getActiveSideSession(uid)).not.toBeNull();

    clockOut(uid, "out");
    expect(getActiveSideSession(uid)).toBeNull();
    // No timer left running after end-of-day
    const timer = getActiveTaskTimeEntry(uid);
    expect(timer?.status === "active").toBe(false);
  });

  it("ends without error when no task timer was involved", () => {
    const uid = "test-emp-side-session-3";
    clockIn(uid);
    const session = startSideSession(uid, "meeting", "standup");
    expect(session.note).toBe("standup");
    expect(session.paused_task_id).toBeNull();
    const ended = endSideSession(uid);
    expect(ended.status).toBe("completed");
  });
});
