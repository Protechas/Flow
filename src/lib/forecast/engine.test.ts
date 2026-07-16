import { describe, expect, it } from "vitest";
import {
  aggregateProjectForecast,
  measureProjectPace,
  remainingDocumentCount,
} from "@/lib/forecast/engine";
import type { WorkPackage } from "@/types/flow";

function task(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: Math.random().toString(36).slice(2),
    project_id: "p1",
    title: "Task",
    status: "working_on_it",
    ...overrides,
  } as WorkPackage;
}

describe("aggregateProjectForecast", () => {
  it("counts only remaining documents on in-progress tasks", () => {
    const rollup = aggregateProjectForecast([
      task({
        status: "working_on_it",
        estimated_document_count: 100,
        current_documents_completed: 40,
        estimated_work_hours: 10,
        estimated_work_days: 2,
      }),
    ]);
    expect(rollup.estimated_total_documents).toBe(60);
    expect(rollup.estimated_total_hours).toBe(6);
    expect(rollup.estimated_total_work_days).toBe(1.2);
  });

  it("excludes done tasks entirely", () => {
    const rollup = aggregateProjectForecast([
      task({ status: "done", estimated_document_count: 500, estimated_work_hours: 50 }),
      task({ status: "assigned", estimated_document_count: 80, estimated_work_hours: 8 }),
    ]);
    expect(rollup.estimated_total_documents).toBe(80);
    expect(rollup.estimated_total_hours).toBe(8);
  });

  it("never goes negative when completed docs exceed the estimate", () => {
    const rollup = aggregateProjectForecast([
      task({
        status: "working_on_it",
        estimated_document_count: 100,
        current_documents_completed: 150,
        estimated_work_hours: 10,
        estimated_work_days: 2,
      }),
      task({ status: "assigned", estimated_document_count: 50, estimated_work_hours: 5 }),
    ]);
    expect(rollup.estimated_total_documents).toBe(50);
    expect(rollup.estimated_total_hours).toBe(5);
  });
});

describe("measureProjectPace", () => {
  it("computes minutes per document from tasks with both hours and docs", () => {
    const pace = measureProjectPace([
      task({ actual_hours: 10, current_documents_completed: 100 }),
      task({ status: "done", actual_hours: 5, current_documents_completed: 20 }),
      // Logged time but no doc count — excluded from the sample
      task({ actual_hours: 30, current_documents_completed: 0 }),
    ]);
    expect(pace).not.toBeNull();
    // 15h * 60 / 120 docs = 7.5 min/doc
    expect(pace?.minutesPerDocument).toBe(7.5);
    expect(pace?.docsSampled).toBe(120);
  });

  it("returns null without enough completed documents to trust", () => {
    expect(
      measureProjectPace([task({ actual_hours: 2, current_documents_completed: 10 })])
    ).toBeNull();
  });

  it("returns null when the ratio is implausible (broken tracking data)", () => {
    expect(
      measureProjectPace([task({ actual_hours: 500, current_documents_completed: 30 })])
    ).toBeNull();
  });
});

describe("remainingDocumentCount", () => {
  it("sums planned minus completed across unfinished tasks only", () => {
    const remaining = remainingDocumentCount([
      task({ status: "working_on_it", estimated_document_count: 100, current_documents_completed: 40 }),
      task({ status: "assigned", estimated_document_count: 50 }),
      task({ status: "done", estimated_document_count: 500, current_documents_completed: 0 }),
      // Overshoot clamps to zero instead of subtracting
      task({ status: "working_on_it", estimated_document_count: 30, current_documents_completed: 45 }),
    ]);
    expect(remaining).toBe(110);
  });
});
