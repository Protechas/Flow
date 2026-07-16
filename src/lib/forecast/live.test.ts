import { describe, expect, it } from "vitest";
import { applyTaskLiveForecast, primaryDueDate } from "@/lib/forecast/live";
import { DEFAULT_FORECAST_SETTINGS } from "@/lib/forecast/engine";
import type { ForecastSettings, WorkPackage } from "@/types/flow";

const settings: ForecastSettings = {
  ...DEFAULT_FORECAST_SETTINGS,
  id: "s1",
  updated_at: "2026-07-01T00:00:00Z",
  minutes_per_document: 9,
};

const NOW = new Date("2026-07-16T15:00:00Z");

function task(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: "t1",
    project_id: "p1",
    title: "Task",
    status: "working_on_it",
    assigned_to: "u1",
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  } as WorkPackage;
}

describe("applyTaskLiveForecast — standard-based due dates", () => {
  it("anchors the due date at the analyst's actual start, priced at standard", () => {
    // 100 docs × 3 min = 300 min = 5h ≈ 0.66 productive days → start + 1 work day
    const pkg = task({
      started_at: "2026-07-14T13:00:00Z",
      estimated_document_count: 100,
      estimated_minutes_per_document: 3,
    });
    const fields = applyTaskLiveForecast(pkg, { settings, now: NOW, activeTaskId: "t1" });
    expect(fields.planning_due_date).toBe("2026-07-15");
    expect(fields.suggested_due_date).toBe("2026-07-15");
    expect(fields.due_date).toBe("2026-07-15");
  });

  it("never moves the due date when the analyst runs slower than standard", () => {
    const pkg = task({
      started_at: "2026-07-14T13:00:00Z",
      estimated_document_count: 100,
      estimated_minutes_per_document: 3,
      current_documents_completed: 10,
    });
    // 600 minutes spent on 10 docs = 60 min/doc — 20× the standard
    const fields = applyTaskLiveForecast(pkg, {
      settings,
      now: NOW,
      activeTaskId: "t1",
      taskActiveMinutes: 600,
    });
    // Target holds at standard...
    expect(fields.due_date).toBe("2026-07-15");
    expect(fields.suggested_due_date).toBe("2026-07-15");
    // ...while the projection honestly lands much later and reads as behind
    expect(fields.active_due_date! > "2026-07-20").toBe(true);
    expect(fields.forecast_variance_days).toBeLessThan(0);
    expect(fields.due_date_status).toBe("behind_capacity");
  });

  it("shows on-track when the analyst beats the standard", () => {
    const pkg = task({
      started_at: "2026-07-15T13:00:00Z",
      estimated_document_count: 100,
      estimated_minutes_per_document: 9,
      current_documents_completed: 50,
    });
    // 100 minutes for 50 docs = 2 min/doc — 4.5× faster than standard
    const fields = applyTaskLiveForecast(pkg, {
      settings,
      now: NOW,
      activeTaskId: "t1",
      taskActiveMinutes: 100,
    });
    expect(fields.due_date_status).toBe("on_track");
    expect(fields.forecast_variance_days).toBeGreaterThanOrEqual(0);
  });

  it("keeps a started-but-paused task anchored at its start, not the queue cursor", () => {
    const pkg = task({
      started_at: "2026-07-14T13:00:00Z",
      estimated_document_count: 100,
      estimated_minutes_per_document: 3,
    });
    // Not the live task — queue chaining would pass a far-future cursor
    const fields = applyTaskLiveForecast(pkg, {
      settings,
      now: NOW,
      activeTaskId: "other-task",
      planningStartDate: "2026-09-01",
    });
    expect(fields.planning_due_date).toBe("2026-07-15");
  });

  it("a manual due date still wins as the displayed promise", () => {
    const pkg = task({
      started_at: "2026-07-14T13:00:00Z",
      estimated_document_count: 100,
      estimated_minutes_per_document: 3,
      manual_due_date: "2026-07-20",
    });
    const fields = applyTaskLiveForecast(pkg, { settings, now: NOW, activeTaskId: "t1" });
    expect(fields.due_date).toBe("2026-07-20");
  });
});

describe("primaryDueDate", () => {
  it("returns the standard target, not the measured-pace projection", () => {
    const pkg = task({
      forecast_mode: "active",
      planning_due_date: "2026-07-15",
      active_due_date: "2026-09-25",
    });
    expect(primaryDueDate(pkg)).toBe("2026-07-15");
  });
});
