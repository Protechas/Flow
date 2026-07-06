import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => false }));

vi.mock("@/lib/data/production-tracking-db", () => ({
  persistTimeClockEntry: vi.fn(),
  persistTaskTimeEntry: vi.fn(),
  persistTaskFileUpload: vi.fn(),
  persistTaskSubmission: vi.fn(),
}));

const recordTimerTimeLogExternal = vi.fn();

vi.mock("@/lib/data/production-bridge", () => ({
  getFlowStore: () => ({ users: [], workPackages: [], projects: [], files: [] }),
  initFlowStore: vi.fn(),
  logActivityBridge: vi.fn(),
  activateTaskLiveForecastExternal: vi.fn(),
  refreshTaskLiveForecastExternal: vi.fn(),
  updateWorkPackageExternal: vi.fn(),
  recordTimerTimeLogExternal: (...args: unknown[]) => recordTimerTimeLogExternal(...args),
}));

vi.mock("@/lib/departments/resolve", () => ({
  resolveDepartmentForUser: () => null,
  getDepartmentName: () => "",
}));

describe("task timer → time log bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    recordTimerTimeLogExternal.mockClear();
  });

  it("records a time log with the session hours when a timer stops", async () => {
    const { replaceProductionTrackingStore, stopTaskTimer } = await import(
      "@/lib/data/production-tracking"
    );

    const startedAt = new Date(Date.now() - 90 * 60000).toISOString(); // 90 min ago

    replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [
        {
          id: "tte-log-1",
          user_id: "user-1",
          task_id: "task-1",
          project_id: "proj-1",
          manufacturer_id: "mfr-1",
          year_work_item_id: "ywi-1",
          started_at: startedAt,
          paused_at: null,
          resumed_at: null,
          completed_at: null,
          total_active_minutes: 0,
          pause_events: [],
          status: "active",
          is_correction_session: false,
          department_id: null,
          created_at: startedAt,
          updated_at: startedAt,
        },
      ],
      taskFileUploads: [],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    const entry = stopTaskTimer("user-1");

    expect(entry.status).toBe("completed");
    expect(entry.total_active_minutes).toBeGreaterThanOrEqual(89);
    expect(recordTimerTimeLogExternal).toHaveBeenCalledTimes(1);
    const log = recordTimerTimeLogExternal.mock.calls[0][0] as {
      id: string;
      work_package_id: string;
      user_id: string;
      hours: number;
      log_date: string;
    };
    expect(log.id).toBe("tte-log-1");
    expect(log.work_package_id).toBe("task-1");
    expect(log.user_id).toBe("user-1");
    expect(log.hours).toBeCloseTo(entry.total_active_minutes / 60, 2);
    expect(log.log_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not record a time log for zero-minute sessions", async () => {
    const { replaceProductionTrackingStore, stopTaskTimer } = await import(
      "@/lib/data/production-tracking"
    );

    const justNow = new Date().toISOString();

    replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [
        {
          id: "tte-log-2",
          user_id: "user-2",
          task_id: "task-2",
          project_id: "proj-1",
          manufacturer_id: "mfr-1",
          year_work_item_id: "ywi-1",
          started_at: justNow,
          paused_at: null,
          resumed_at: null,
          completed_at: null,
          total_active_minutes: 0,
          pause_events: [],
          status: "active",
          is_correction_session: false,
          department_id: null,
          created_at: justNow,
          updated_at: justNow,
        },
      ],
      taskFileUploads: [],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    stopTaskTimer("user-2");
    expect(recordTimerTimeLogExternal).not.toHaveBeenCalled();
  });
});
