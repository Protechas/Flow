import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }));

const TASK = "5b8f57a2-64f5-4f4e-9d51-2f2b45f2b222";
const USER = "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4";

function mockBridge() {
  vi.doMock("@/lib/data/production-bridge", () => ({
    getFlowStore: () => ({ users: [], projects: [], workPackages: [] }),
    initFlowStore: vi.fn(),
    logActivityBridge: vi.fn(),
    activateTaskLiveForecastExternal: vi.fn(),
    recordTimerTimeLogExternal: vi.fn(),
    refreshTaskLiveForecastExternal: vi.fn(),
    updateWorkPackageExternal: vi.fn(),
  }));
  vi.doMock("@/lib/departments/resolve", () => ({
    resolveDepartmentForUser: () => "15c1b514-678a-40cf-9aef-cd95f5649316",
    getDepartmentName: () => "Information Solutions",
  }));
}

function timerEntry(
  id: string,
  status: "completed" | "active",
  minutes: number,
  startedAt: string
) {
  return {
    id,
    user_id: USER,
    task_id: TASK,
    department_id: null,
    project_id: "19a24e28-1fb2-406b-bc5c-ce7ededdbfa9",
    manufacturer_id: "",
    year_work_item_id: "",
    started_at: startedAt,
    paused_at: null,
    resumed_at: status === "active" ? new Date().toISOString() : null,
    completed_at: status === "completed" ? startedAt : null,
    total_active_minutes: minutes,
    pause_events: [],
    status,
    is_correction_session: false,
    created_at: startedAt,
    updated_at: startedAt,
  };
}

describe("timer totals never reset when a new session starts", () => {
  beforeEach(() => {
    vi.resetModules();
    mockBridge();
  });

  it("getTotalTaskMinutes sums completed history plus the live timer", async () => {
    const mod = await import("@/lib/data/production-tracking");
    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [
        timerEntry("t1", "completed", 120, "2026-07-07T10:00:00Z"),
        timerEntry("t2", "completed", 45, "2026-07-07T14:00:00Z"),
        timerEntry("t3", "active", 10, new Date().toISOString()),
      ],
      taskFileUploads: [],
      taskSubmissions: [],
      qaReviewRecords: [],
    });
    // 120 + 45 + ~10 (live) — the old code returned only the live entry (10).
    expect(mod.getTotalTaskMinutes(TASK)).toBeGreaterThanOrEqual(175);
  });

  it("getPendingSessionTaskMinutes keeps prior session entries while a timer runs", async () => {
    const mod = await import("@/lib/data/production-tracking");
    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [
        timerEntry("t1", "completed", 90, "2026-07-07T10:00:00Z"),
        timerEntry("t2", "active", 5, new Date().toISOString()),
      ],
      taskFileUploads: [],
      taskSubmissions: [],
      qaReviewRecords: [],
    });
    expect(mod.getPendingSessionTaskMinutes(TASK, USER)).toBeGreaterThanOrEqual(95);
  });
});
