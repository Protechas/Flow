import { describe, expect, it } from "vitest";
import {
  clockIn,
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  MAX_SHIFT_MINUTES,
  startTaskTimer,
  sweepStaleProductionEntries,
} from "@/lib/data/production-tracking";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

describe("sweepStaleProductionEntries", () => {
  it("leaves a normal shift alone", () => {
    const userId = "sweep-user-normal";
    clockIn(userId);
    const result = sweepStaleProductionEntries(hoursFromNow(2));
    expect(result.closedClockEntries.find((e) => e.user_id === userId)).toBeUndefined();
    expect(getActiveClockEntry(userId)).not.toBeNull();
  });

  it("closes a forgotten shift at the 12h cap and marks it for review", () => {
    const userId = "sweep-user-forgot";
    const entry = clockIn(userId);
    const result = sweepStaleProductionEntries(hoursFromNow(30));
    const closed = result.closedClockEntries.find((e) => e.user_id === userId);
    expect(closed).toBeDefined();
    expect(closed!.total_minutes).toBe(MAX_SHIFT_MINUTES);
    expect(closed!.status).toBe("completed");
    expect(closed!.edit_reason).toMatch(/Auto clock-out/);
    // Closed at clock_in + cap, not at sweep time.
    const expectedOut = new Date(entry.clock_in_at).getTime() + MAX_SHIFT_MINUTES * 60_000;
    expect(new Date(closed!.clock_out_at!).getTime()).toBe(expectedOut);
    expect(getActiveClockEntry(userId)).toBeNull();

    // Idempotent: a second sweep finds nothing.
    const again = sweepStaleProductionEntries(hoursFromNow(31));
    expect(again.closedClockEntries.find((e) => e.user_id === userId)).toBeUndefined();
  });

  it("stops a runaway timer with capped minutes credited to the start day", () => {
    initFlowStore();
    const task = getFlowStore().workPackages[0];
    expect(task).toBeDefined();
    const userId = "sweep-user-timer";
    startTaskTimer(userId, task.id);

    const result = sweepStaleProductionEntries(hoursFromNow(40));
    const stopped = result.stoppedTimers.find((t) => t.user_id === userId);
    expect(stopped).toBeDefined();
    expect(stopped!.status).toBe("completed");
    expect(stopped!.total_active_minutes).toBeLessThanOrEqual(MAX_SHIFT_MINUTES);
    expect(getActiveTaskTimeEntry(userId)).toBeNull();
  });
});
