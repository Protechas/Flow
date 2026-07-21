import { describe, expect, it } from "vitest";
import { buildWeeklyUpdateDraft, weeklyUpdateWindowState } from "./weekly-update";
import type { DailyWrapUp } from "@/types/flow";

const WINDOW = { opens: { day: 4, hour: 17 }, due: { day: 5, hour: 15 } };

describe("weeklyUpdateWindowState (Thu 17:00 → Fri 15:00)", () => {
  it("is before_open earlier in the week", () => {
    expect(weeklyUpdateWindowState(WINDOW, 1, 9)).toBe("before_open"); // Mon 9am
    expect(weeklyUpdateWindowState(WINDOW, 4, 16)).toBe("before_open"); // Thu 4pm
  });
  it("opens Thursday 5pm through Friday before 3pm", () => {
    expect(weeklyUpdateWindowState(WINDOW, 4, 17)).toBe("open"); // Thu 5pm
    expect(weeklyUpdateWindowState(WINDOW, 5, 14)).toBe("open"); // Fri 2pm
  });
  it("closes Friday 3pm and stays closed through the weekend", () => {
    expect(weeklyUpdateWindowState(WINDOW, 5, 15)).toBe("closed"); // Fri 3pm
    expect(weeklyUpdateWindowState(WINDOW, 6, 10)).toBe("closed"); // Sat
    expect(weeklyUpdateWindowState(WINDOW, 0, 10)).toBe("closed"); // Sun (end of Mon-based week)
  });
});

function wrap(date: string, over: Partial<DailyWrapUp> = {}): DailyWrapUp {
  return {
    id: `w-${date}`,
    user_id: "u1",
    wrap_date: date,
    completed_summary: null,
    blockers: null,
    needs_support: false,
    needs_support_note: null,
    created_at: `${date}T22:00:00Z`,
    reviewed_at: null,
    reviewed_by: null,
    internal_notes: null,
    follow_up_needed: false,
    follow_up_notes: null,
    ...over,
  };
}

describe("buildWeeklyUpdateDraft", () => {
  const FIELDS = [
    { id: "work_completed" },
    { id: "time_expectation" },
    { id: "errors_issues" },
    { id: "next_steps" },
  ];

  it("compiles wrap-up summaries, blockers, and completed tasks into the four sections", () => {
    const draft = buildWeeklyUpdateDraft({
      fields: FIELDS,
      wrapUps: [
        wrap("2026-07-21", {
          completed_summary: "Regression suite for NICC",
          blockers: "Waiting on test data",
          sections: { next_action: "Start Toyota batch", estimated_completion: "~2 days left" },
        }),
        wrap("2026-07-20", { completed_summary: "Set up harness" }),
      ],
      completedTasks: [{ title: "Harness setup", completed_date: "2026-07-20" }],
    });
    expect(draft.work_completed).toContain("2026-07-20:\nSet up harness");
    expect(draft.work_completed).toContain("Regression suite for NICC");
    expect(draft.work_completed).toContain("Tasks completed: Harness setup");
    expect(draft.errors_issues).toBe("2026-07-21: Waiting on test data");
    expect(draft.time_expectation).toBe("~2 days left");
    expect(draft.next_steps).toBe("Start Toyota batch");
  });

  it("leaves unknown field ids blank and handles an empty week", () => {
    const draft = buildWeeklyUpdateDraft({
      fields: [{ id: "work_completed" }, { id: "custom_field" }],
      wrapUps: [],
      completedTasks: [],
    });
    expect(draft.work_completed).toBe("");
    expect(draft.custom_field).toBe("");
  });
});
