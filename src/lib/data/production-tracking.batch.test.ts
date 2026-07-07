import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }));

const TASK_ID = "5b8f57a2-64f5-4f4e-9d51-2f2b45f2b111";
const USER_ID = "75cbdc3d-0d5c-4fec-8cba-472e6ef6bff4";

const updateWorkPackageExternal = vi.fn();
let pkgStatus = "working_on_it";

function mockBridge() {
  vi.doMock("@/lib/data/production-bridge", () => ({
    getFlowStore: () => ({
      users: [],
      projects: [],
      workPackages: [
        {
          id: TASK_ID,
          project_id: "19a24e28-1fb2-406b-bc5c-ce7ededdbfa9",
          manufacturer_id: "fa458ec4-1c7f-4818-ab75-d4b32715de34",
          status: pkgStatus,
        },
      ],
    }),
    initFlowStore: vi.fn(),
    logActivityBridge: vi.fn(),
    activateTaskLiveForecastExternal: vi.fn(),
    recordTimerTimeLogExternal: vi.fn(),
    refreshTaskLiveForecastExternal: vi.fn(),
    updateWorkPackageExternal,
  }));
  vi.doMock("@/lib/departments/resolve", () => ({
    resolveDepartmentForUser: () => "15c1b514-678a-40cf-9aef-cd95f5649316",
    getDepartmentName: () => "Information Solutions",
  }));
}

function fileRow(id: string, uploadedAt: string) {
  return {
    id,
    task_id: TASK_ID,
    project_id: "19a24e28-1fb2-406b-bc5c-ce7ededdbfa9",
    user_id: USER_ID,
    file_name: `${id}.pdf`,
    file_type: "application/pdf",
    file_size: 100,
    file_url_or_path: `${id}.pdf`,
    uploaded_at: uploadedAt,
    created_at: uploadedAt,
  };
}

describe("batch submissions", () => {
  beforeEach(() => {
    vi.resetModules();
    updateWorkPackageExternal.mockClear();
    pkgStatus = "working_on_it";
    mockBridge();
  });

  it("submits only new files as a batch and leaves the task workable", async () => {
    const mod = await import("@/lib/data/production-tracking");
    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [],
      taskFileUploads: [fileRow("file-1", "2026-07-07T10:00:00Z")],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    const batch = mod.submitBatchForReview({ task_id: TASK_ID, user_id: USER_ID });
    expect(batch.submission_type).toBe("batch");
    expect(batch.status).toBe("submitted");
    expect(batch.file_ids).toEqual(["file-1"]);
    // A batch must never lock the task the way a final submit does.
    expect(updateWorkPackageExternal).not.toHaveBeenCalled();
  });

  it("excludes files already covered by a previous submission", async () => {
    const mod = await import("@/lib/data/production-tracking");
    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [],
      taskFileUploads: [fileRow("file-1", "2026-07-07T10:00:00Z")],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    mod.submitBatchForReview({ task_id: TASK_ID, user_id: USER_ID });
    expect(() => mod.submitBatchForReview({ task_id: TASK_ID, user_id: USER_ID })).toThrow(
      /at least one new file/i
    );

    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [],
      taskFileUploads: [
        fileRow("file-1", "2026-07-07T10:00:00Z"),
        fileRow("file-2", "2026-07-08T10:00:00Z"),
      ],
      taskSubmissions: mod.getSubmissionsForTask(TASK_ID),
      qaReviewRecords: [],
    });
    const second = mod.submitBatchForReview({ task_id: TASK_ID, user_id: USER_ID });
    expect(second.file_ids).toEqual(["file-2"]);
  });

  it("correction decisions flag the task without locking it", async () => {
    const mod = await import("@/lib/data/production-tracking");
    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [],
      taskFileUploads: [fileRow("file-1", "2026-07-07T10:00:00Z")],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    const batch = mod.submitBatchForReview({ task_id: TASK_ID, user_id: USER_ID });
    const resolved = mod.resolveBatchSubmission(batch.id, "correction_requested", "fix headers");
    expect(resolved.status).toBe("correction_requested");
    expect(updateWorkPackageExternal).toHaveBeenCalledWith(TASK_ID, {
      status: "correction_needed",
    });
    // Already-reviewed batches cannot be decided twice.
    expect(() => mod.resolveBatchSubmission(batch.id, "approved")).toThrow(/already/i);
  });

  it("approving a batch clears an earlier batch correction flag", async () => {
    const mod = await import("@/lib/data/production-tracking");
    mod.replaceProductionTrackingStore({
      timeClockEntries: [],
      taskTimeEntries: [],
      taskFileUploads: [fileRow("file-1", "2026-07-07T10:00:00Z")],
      taskSubmissions: [],
      qaReviewRecords: [],
    });

    pkgStatus = "correction_needed";
    const batch = mod.submitBatchForReview({ task_id: TASK_ID, user_id: USER_ID });
    mod.resolveBatchSubmission(batch.id, "approved");
    expect(updateWorkPackageExternal).toHaveBeenCalledWith(TASK_ID, {
      status: "working_on_it",
    });
  });
});
