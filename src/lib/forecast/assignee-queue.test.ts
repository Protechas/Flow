import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  computeAssigneeQueueForecasts,
  listAssigneeWorkQueue,
} from "@/lib/forecast/assignee-queue";
import {
  calculateTaskForecast,
  DEFAULT_FORECAST_SETTINGS,
} from "@/lib/forecast/engine";
import type { ForecastSettings, WorkPackage, WorkStatus } from "@/types/flow";

const ASSIGNEE = "user-a";
const NOW = new Date("2025-06-23T15:00:00.000Z"); // Monday in America/Chicago
const TODAY = "2025-06-23";

function makeSettings(): ForecastSettings {
  return {
    id: "fs-1",
    updated_at: NOW.toISOString(),
    updated_by: null,
    ...DEFAULT_FORECAST_SETTINGS,
  };
}

function makeTask(
  id: string,
  status: WorkStatus,
  docCount: number,
  overrides: Partial<WorkPackage> = {}
): WorkPackage {
  return {
    id,
    project_id: "proj-1",
    manufacturer_id: "mfg-1",
    year_work_item_id: "ywi-1",
    year: 2025,
    title: id,
    assigned_to: ASSIGNEE,
    status,
    priority: "medium",
    estimated_hours: 0,
    actual_hours: 0,
    estimated_document_count: docCount,
    complexity_level: "standard",
    file_count: 0,
    qa_status: "pending",
    correction_count: 0,
    forecast_mode: "planning",
    assigned_at: "2025-06-20T12:00:00.000Z",
    created_at: "2025-06-20T12:00:00.000Z",
    updated_at: "2025-06-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("assignee queue forecasting", () => {
  const prevTz = process.env.NEXT_PUBLIC_FLOW_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE = "America/Chicago";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE = prevTz;
  });

  it("orders queue like pickNextTask and pins the active timer task first", () => {
    const tasks = [
      makeTask("t-wait", "waiting", 10),
      makeTask("t-active", "working_on_it", 10, { forecast_mode: "active", started_at: NOW.toISOString() }),
      makeTask("t-assigned", "assigned", 10),
    ];
    const queue = listAssigneeWorkQueue(tasks, "t-active");
    expect(queue.map((t) => t.id)).toEqual(["t-active", "t-assigned", "t-wait"]);
  });

  it("chains waiting tasks after work ahead in the queue", () => {
    const settings = makeSettings();
    const task1 = makeTask("t1", "assigned", 140);
    const task2 = makeTask("t2", "waiting", 70);

    const soloTask2 = calculateTaskForecast(
      {
        estimated_document_count: 70,
        complexity_level: "standard",
        start_date: TODAY,
      },
      { settings, now: NOW }
    );

    const forecasts = computeAssigneeQueueForecasts({
      assigneeId: ASSIGNEE,
      packages: [task1, task2],
      settings,
      activeTaskId: null,
      now: NOW,
    });

    const t1Due = forecasts.get("t1")?.planning_due_date;
    const t2Due = forecasts.get("t2")?.planning_due_date;

    expect(t1Due).toBeTruthy();
    expect(t2Due).toBeTruthy();
    expect(t2Due!).not.toBe(soloTask2.suggested_due_date);
    expect(t2Due! > t1Due!).toBe(true);
  });

  it("keeps only the active task on live forecast while queueing the rest", () => {
    const settings = makeSettings();
    const active = makeTask("t-active", "working_on_it", 100, {
      forecast_mode: "active",
      started_at: NOW.toISOString(),
      current_documents_completed: 40,
      forecast_start_date: TODAY,
    });
    const waiting = makeTask("t-wait", "waiting", 50);

    const forecasts = computeAssigneeQueueForecasts({
      assigneeId: ASSIGNEE,
      packages: [active, waiting],
      settings,
      activeTaskId: "t-active",
      taskMinutesById: { "t-active": 280 },
      now: NOW,
    });

    expect(forecasts.get("t-active")?.forecast_mode).toBe("active");
    expect(forecasts.get("t-active")?.active_due_date).toBeTruthy();
    expect(forecasts.get("t-wait")?.forecast_mode).toBe("planning");
    expect(forecasts.get("t-wait")?.active_due_date ?? null).toBeNull();
    expect(forecasts.get("t-wait")?.planning_due_date).toBeTruthy();
  });
});
