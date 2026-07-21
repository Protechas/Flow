import { describe, expect, it } from "vitest";
import { buildThenVsNow } from "./then-vs-now";
import type { LegacyMetricRow } from "./monday-baseline";
import type { TaskFileUpload, TaskSubmissionRecord } from "@/types/flow";

const legacy: LegacyMetricRow[] = [
  // Doc work: 10 items, all clocked, 200 min total => 20 min/doc
  { person_name: "A", week_start: "2025-01-06", category: "special_functions", items_done: 10, clock_seconds: 12000, items_with_clock: 10 },
  // Quick checks: volume only, must not touch the rate
  { person_name: "A", week_start: "2025-01-06", category: "si_check", items_done: 100, clock_seconds: 3000, items_with_clock: 100 },
  { person_name: "B", week_start: "2025-01-13", category: "other", items_done: 5, clock_seconds: 6000, items_with_clock: 5 },
];

function upload(day: string, user: string): TaskFileUpload {
  return {
    id: `u-${day}-${user}-${Math.random()}`,
    task_id: "t1",
    project_id: "p1",
    user_id: user,
    file_name: "f.pdf",
    file_type: "pdf",
    file_size: 1,
    file_url_or_path: "x",
    uploaded_at: `${day}T12:00:00Z`,
    created_at: `${day}T12:00:00Z`,
  };
}

function submission(minutes: number, docs: number): TaskSubmissionRecord {
  return {
    id: `s-${Math.random()}`,
    task_id: "t1",
    project_id: "p1",
    user_id: "u1",
    submitted_at: "2026-07-06T12:00:00Z",
    uploaded_file_count: docs,
    total_task_minutes: minutes,
    average_minutes_per_document: minutes / docs,
    documents_per_hour: 60 / (minutes / docs),
    original_task_minutes: minutes,
    correction_task_minutes: 0,
    status: "submitted",
    submission_type: "final",
    file_ids: null,
    notes: null,
    created_at: "2026-07-06T12:00:00Z",
    updated_at: "2026-07-06T12:00:00Z",
  };
}

describe("buildThenVsNow", () => {
  const uploads = [
    upload("2026-07-01", "u1"),
    upload("2026-07-01", "u1"),
    upload("2026-07-02", "u2"),
    upload("2026-06-01", "u3"), // before flow era — excluded
  ];

  const data = buildThenVsNow({
    legacy,
    uploads,
    submissions: [submission(100, 10)], // 10 min/doc
    wagePerHour: 22,
    flowStartDate: "2026-06-29",
    now: new Date("2026-07-14T00:00:00Z"),
  });

  it("computes the Monday rate from doc-work categories only", () => {
    // 200 + 100 minutes over 15 docs = 20 min/doc; si_check ignored
    expect(data.monday.minutesPerDoc).toBe(20);
    expect(data.monday.docWorkItems).toBe(15);
    expect(data.monday.doneItems).toBe(115);
  });

  it("computes Flow minutes per doc from submissions", () => {
    expect(data.flow.minutesPerDoc).toBe(10);
    expect(data.flow.docsDone).toBe(3); // era-scoped
  });

  it("computes savings at the wage", () => {
    expect(data.savings.minutesSavedPerDoc).toBe(10);
    // pace: 3 docs / 15 days * 30 = 6/mo; 10 min * 6 = 1h => $22
    expect(data.flow.monthlyDocPace).toBe(6);
    expect(data.savings.hoursSavedPerMonth).toBe(1);
    expect(data.savings.dollarsSavedPerMonth).toBe(22);
    expect(data.savings.dollarsSavedPerYear).toBe(264);
  });

  it("improvement percentages point the right way", () => {
    expect(data.timePerDocChangePct).toBe(-50);
  });

  it("weekly series separates eras", () => {
    const eras = new Set(data.weekly.map((p) => p.era));
    expect(eras.has("monday")).toBe(true);
    expect(eras.has("flow")).toBe(true);
  });

  it("excludes the in-progress week from the chart and rate, but not totals", () => {
    // "Now" is Tuesday Jul 21 — the week of Jul 20 is 1.5 days old.
    const midWeek = buildThenVsNow({
      legacy,
      uploads: [
        upload("2026-07-14", "u1"),
        upload("2026-07-15", "u1"),
        upload("2026-07-16", "u2"),
        upload("2026-07-20", "u1"),
        upload("2026-07-21", "u2"),
      ],
      submissions: [],
      wagePerHour: 22,
      flowStartDate: "2026-06-29",
      now: new Date("2026-07-21T18:00:00Z"),
    });
    const flowWeeks = midWeek.weekly.filter((p) => p.era === "flow").map((p) => p.week);
    expect(flowWeeks).toContain("2026-07-13");
    expect(flowWeeks).not.toContain("2026-07-20");
    // Totals still include the partial week…
    expect(midWeek.flow.docsDone).toBe(5);
    // …but the rate uses complete weeks only: 3 docs / (2 people × 5 days).
    expect(midWeek.flow.docsPerPersonDay).toBe(0.3);
  });

  it("handles an empty Flow era without dividing by zero", () => {
    const empty = buildThenVsNow({
      legacy,
      uploads: [],
      submissions: [],
      wagePerHour: 22,
      flowStartDate: "2026-06-29",
      now: new Date("2026-07-14T00:00:00Z"),
    });
    expect(empty.flow.minutesPerDoc).toBeNull();
    expect(empty.savings.dollarsSavedPerMonth).toBeNull();
    expect(empty.productionRateChangePct).toBeNull();
  });
});
