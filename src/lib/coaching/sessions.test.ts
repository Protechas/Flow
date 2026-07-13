import { describe, expect, it } from "vitest";
import {
  acknowledgeCoachingSession,
  createCoachingSession,
  listCoachingSessions,
  resolveCoachingSession,
} from "@/lib/coaching/sessions";

describe("coaching sessions", () => {
  it("records the full accountability loop: log → acknowledge → resolve", async () => {
    const session = await createCoachingSession({
      employee_id: "user-desi",
      coach_id: "user-boss",
      session_date: "2026-07-13",
      category: "time_attendance",
      level: "coaching",
      summary: "Discussed unacceptable clock-in times last week.",
      expectation: "Clocked in by 8:05 daily; message the lead if something comes up.",
      follow_up_date: "2026-07-20",
    });
    expect(session.status).toBe("open");
    expect(session.acknowledged_at).toBeNull();

    // Employee acknowledges the conversation happened
    const acked = await acknowledgeCoachingSession(session.id);
    expect(acked?.acknowledged_at).toBeTruthy();

    // Coach closes the loop after the follow-up
    const resolved = await resolveCoachingSession(session.id, "On time two weeks straight.");
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolution_note).toContain("two weeks");

    // Record survives with everything on it
    const mine = await listCoachingSessions({ employeeId: "user-desi" });
    const found = mine.find((s) => s.id === session.id);
    expect(found?.summary).toContain("clock-in times");
    expect(found?.expectation).toContain("8:05");
    expect(found?.status).toBe("resolved");
  });

  it("filters by status", async () => {
    await createCoachingSession({
      employee_id: "user-desi",
      coach_id: "user-boss",
      session_date: "2026-07-13",
      category: "quality",
      level: "verbal_warning",
      summary: "Second quality miss this month.",
    });
    const open = await listCoachingSessions({ employeeId: "user-desi", status: "open" });
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((s) => s.status === "open")).toBe(true);
  });
});
