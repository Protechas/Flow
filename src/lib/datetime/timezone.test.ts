import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("app timezone", () => {
  const prev = process.env.NEXT_PUBLIC_FLOW_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE = "America/Chicago";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE = prev;
  });

  it("formats UTC instants in organization local time", async () => {
    const { formatAppTime } = await import("@/lib/datetime/timezone");
    // 7:14 PM UTC = 2:14 PM CDT (June, UTC-5)
    expect(formatAppTime("2025-06-30T19:14:00.000Z")).toBe("2:14 PM");
  });

  it("buckets today by organization timezone, not UTC", async () => {
    const { appTodayDate, isAppCalendarDay } = await import("@/lib/datetime/timezone");
    // 11 PM Central on June 30 is already 5 AM UTC on July 1
    const centralLateNight = new Date("2025-07-01T04:00:00.000Z");
    expect(appTodayDate(centralLateNight)).toBe("2025-06-30");
    expect(isAppCalendarDay("2025-07-01T04:00:00.000Z", "2025-06-30")).toBe(true);
    expect(isAppCalendarDay("2025-07-01T04:00:00.000Z", "2025-07-01")).toBe(false);
  });
});
