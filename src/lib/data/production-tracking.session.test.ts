import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => false }));

vi.mock("@/lib/data/production-tracking-db", () => ({
  persistTimeClockEntry: vi.fn(),
  persistTaskTimeEntry: vi.fn(),
  persistTaskFileUpload: vi.fn(),
  persistTaskSubmission: vi.fn(),
}));

vi.mock("@/lib/data/production-bridge", () => ({
  getFlowStore: () => ({ users: [], workPackages: [], projects: [], files: [] }),
  initFlowStore: vi.fn(),
  logActivityBridge: vi.fn(),
  activateTaskLiveForecastExternal: vi.fn(),
  refreshTaskLiveForecastExternal: vi.fn(),
  updateWorkPackageExternal: vi.fn(),
}));

vi.mock("@/lib/departments/resolve", () => ({
  resolveDepartmentForUser: () => null,
  getDepartmentName: () => "",
}));

describe("pending session production metrics", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("counts only files uploaded after the latest submission", async () => {
    const {
      replaceProductionTrackingStore,
      getTaskFileCount,
      getTaskFilesForPendingSession,
      getPendingSessionTaskMinutes,
    } = await import("@/lib/data/production-tracking");

    const taskId = "task-1";
    const userId = "user-1";

    replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [
        {
          id: "tte-1",
          user_id: userId,
          task_id: taskId,
          project_id: "proj-1",
          manufacturer_id: "mfr-1",
          year_work_item_id: "ywi-1",
          started_at: "2026-06-30T20:00:00.000Z",
          paused_at: null,
          resumed_at: null,
          completed_at: null,
          total_active_minutes: 0,
          pause_events: [],
          status: "active",
          is_correction_session: false,
          department_id: null,
          created_at: "2026-06-30T20:00:00.000Z",
          updated_at: "2026-06-30T20:00:00.000Z",
        },
      ],
      taskFileUploads: [
        {
          id: "f-old",
          task_id: taskId,
          project_id: "proj-1",
          department_id: null,
          user_id: userId,
          file_name: "old.pdf",
          file_type: "application/pdf",
          file_size: 100,
          file_url_or_path: "/old",
          uploaded_at: "2026-06-30T12:00:00.000Z",
          created_at: "2026-06-30T12:00:00.000Z",
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `f-new-${i}`,
          task_id: taskId,
          project_id: "proj-1",
          department_id: null,
          user_id: userId,
          file_name: `new-${i}.pdf`,
          file_type: "application/pdf",
          file_size: 100,
          file_url_or_path: `/new-${i}`,
          uploaded_at: `2026-06-30T20:${String(10 + i).padStart(2, "0")}:00.000Z`,
          created_at: `2026-06-30T20:${String(10 + i).padStart(2, "0")}:00.000Z`,
        })),
      ],
      taskSubmissions: [
        {
          id: "sub-1",
          task_id: taskId,
          project_id: "proj-1",
          user_id: userId,
          submitted_at: "2026-06-30T18:00:00.000Z",
          uploaded_file_count: 28,
          total_task_minutes: 120,
          average_minutes_per_document: 4.29,
          documents_per_hour: 14,
          original_task_minutes: 120,
          correction_task_minutes: 0,
          status: "submitted",
          notes: null,
          created_at: "2026-06-30T18:00:00.000Z",
          updated_at: "2026-06-30T18:00:00.000Z",
        },
      ],
      qaReviewRecords: [],
    });

    expect(getTaskFilesForPendingSession(taskId)).toHaveLength(8);
    expect(getTaskFileCount(taskId)).toBe(8);
    expect(getPendingSessionTaskMinutes(taskId, userId)).toBeGreaterThan(0);
  });
});
