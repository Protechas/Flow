import { describe, expect, it } from "vitest";
import { clockIn, clockOut, getActiveClockEntry, getTodayClockEntries } from "@/lib/data/production-tracking";
import { getEmployeeClockStatus } from "@/lib/time-clock/labels";

const uid = "test-emp-free-schedule";

function status() {
  return getEmployeeClockStatus(getActiveClockEntry(uid), getTodayClockEntries(uid));
}

describe("multiple lunches in one day (free schedule)", () => {
  it("supports lunch → back → lunch → back → out", () => {
    clockIn(uid);
    expect(status()).toBe("on_shift");

    clockOut(uid, "lunch");
    expect(status()).toBe("on_lunch");

    clockIn(uid); // back from lunch 1
    expect(status()).toBe("on_shift");

    clockOut(uid, "lunch"); // lunch 2 — must not throw or mislabel
    expect(status()).toBe("on_lunch");

    clockIn(uid); // back from lunch 2
    expect(status()).toBe("on_shift");

    clockOut(uid, "out");
    expect(status()).toBe("off_shift");

    // Day holds three completed entries — nothing collapsed or rejected
    expect(getTodayClockEntries(uid).filter((e) => e.clock_out_at).length).toBe(3);
  });
});
